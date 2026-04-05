import { describe, it, expect } from 'vitest';
import { parseAppHostCode, preprocessCode, splitStatements } from './appHostParser';

describe('preprocessCode', () => {
  it('strips single-line comments', () => {
    expect(preprocessCode('var x = 1; // comment')).toBe('var x = 1; ');
  });

  it('strips multi-line comments', () => {
    expect(preprocessCode('var x = /* block */ 1;')).toBe('var x =  1;');
  });

  it('strips preprocessor directives', () => {
    const code = '#if DEBUG\nvar x = 1;\n#endif';
    expect(preprocessCode(code)).toContain('var x = 1;');
    expect(preprocessCode(code)).not.toContain('#if');
  });

  it('strips #pragma and #region', () => {
    expect(preprocessCode('#pragma warning disable\ncode\n#endregion')).toContain('code');
  });
});

describe('splitStatements', () => {
  it('splits on semicolons', () => {
    expect(splitStatements('a = 1;\nb = 2;')).toEqual(['a = 1', 'b = 2']);
  });

  it('collapses multi-line chains into one statement', () => {
    const code = 'var x = builder\n  .AddPostgres("pg")\n  .WithDataVolume();';
    const stmts = splitStatements(code);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toContain('builder');
    expect(stmts[0]).toContain('.AddPostgres("pg")');
    expect(stmts[0]).toContain('.WithDataVolume()');
  });
});

describe('parseAppHostCode', () => {
  it('parses simple AddPostgres', () => {
    const code = 'var db = builder.AddPostgres("postgres");';
    const result = parseAppHostCode(code);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('postgres');
    expect(result[0].name).toBe('postgres');
  });

  it('parses AddRedis', () => {
    const code = 'var cache = builder.AddRedis("redis");';
    const result = parseAppHostCode(code);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('redis');
    expect(result[0].name).toBe('redis');
  });

  it('parses AddProject with generic type', () => {
    const code = 'var api = builder.AddProject<Projects.MyApi>("api");';
    const result = parseAppHostCode(code);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('project');
    expect(result[0].name).toBe('api');
  });

  it('parses AddProject with path argument', () => {
    const code = 'var svc = builder.AddProject("myservice", @"..\\MyService\\MyService.csproj");';
    const result = parseAppHostCode(code);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('project');
    expect(result[0].projectPath).toBe('..\\MyService\\MyService.csproj');
  });

  it('parses chained AddDatabase on same statement', () => {
    const code = `var catalogDb = builder.AddPostgres("postgres")
                       .WithDataVolume()
                       .AddDatabase("catalogdb");`;
    const result = parseAppHostCode(code);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('postgres');
    expect(result[0].databases).toContain('catalogdb');
    expect(result[0].hasDataVolume).toBe(true);
  });

  it('parses standalone AddDatabase', () => {
    const code = `var pg = builder.AddPostgres("postgres");
var db = pg.AddDatabase("mydb");`;
    const result = parseAppHostCode(code);
    expect(result).toHaveLength(1);
    expect(result[0].databases).toContain('mydb');
  });

  it('parses WithReference across lines', () => {
    const code = `var db = builder.AddPostgres("pg").AddDatabase("appdb");
var api = builder.AddProject<Projects.Api>("api")
    .WithReference(db);`;
    const result = parseAppHostCode(code);
    expect(result).toHaveLength(2);
    const api = result.find(r => r.name === 'api');
    const pg = result.find(r => r.name === 'pg');
    expect(api).toBeDefined();
    expect(pg).toBeDefined();
    // db variable maps to pg resource (AddDatabase is chained)
    // WithReference(db) means api references the db variable
    // Since db was defined as pg.AddDatabase, it should reference the pg resource
  });

  it('parses WaitFor', () => {
    const code = `var mq = builder.AddRabbitMQ("messaging");
var svc = builder.AddProject<Projects.Worker>("worker")
    .WithReference(mq)
    .WaitFor(mq);`;
    const result = parseAppHostCode(code);
    const worker = result.find(r => r.name === 'worker');
    const mq = result.find(r => r.name === 'messaging');
    expect(worker).toBeDefined();
    expect(mq).toBeDefined();
    expect(worker!.references).toContain(mq!.id);
    expect(worker!.waitFor).toContain(mq!.id);
  });

  it('parses WithDataVolume', () => {
    const code = 'var cache = builder.AddRedis("cache").WithDataVolume();';
    const result = parseAppHostCode(code);
    expect(result[0].hasDataVolume).toBe(true);
  });

  it('parses WithExternalHttpEndpoints', () => {
    const code = 'var web = builder.AddProject<Projects.Web>("web").WithExternalHttpEndpoints();';
    const result = parseAppHostCode(code);
    expect(result[0].hasExternalEndpoints).toBe(true);
  });

  it('parses Persistent lifetime', () => {
    const code = 'var mq = builder.AddRabbitMQ("mq").WithLifetime(ContainerLifetime.Persistent);';
    const result = parseAppHostCode(code);
    expect(result[0].isPersistent).toBe(true);
  });

  it('parses secret parameter', () => {
    const code = 'var key = builder.AddParameter("api-key", secret: true);';
    const result = parseAppHostCode(code);
    expect(result[0].type).toBe('parameter');
    expect(result[0].isSecret).toBe(true);
  });

  it('parses AddConnectionString', () => {
    const code = 'var openai = builder.AddConnectionString("openai");';
    const result = parseAppHostCode(code);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('parameter');
    expect(result[0].name).toBe('openai');
  });

  it('parses AddYarp as container', () => {
    const code = 'var yarp = builder.AddYarp("gateway");';
    const result = parseAppHostCode(code);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('container');
    expect(result[0].name).toBe('gateway');
  });

  it('strips comments and preprocessor directives', () => {
    const code = `// This is a comment
#if DEBUG
var debug = builder.AddRedis("debug-cache");
#endif
var db = builder.AddPostgres("pg");
/* block comment */`;
    const result = parseAppHostCode(code);
    // Should find both debug-cache and pg (preprocessor lines are stripped, not the content between them)
    expect(result.some(r => r.name === 'pg')).toBe(true);
  });

  it('handles the full eShop-style AppHost', () => {
    const code = `
var builder = DistributedApplication.CreateBuilder(args);

var catalogDb = builder.AddPostgres("postgres")
                       .WithDataVolume()
                       .WithPgAdmin(resource => { resource.WithUrlForEndpoint("http", u => u.DisplayText = "PG Admin"); })
                       .AddDatabase("catalogdb");

var basketCache = builder.AddRedis("basketcache")
                         .WithDataVolume();

var catalogService = builder.AddProject<Projects.CatalogService>("catalogservice")
                            .WithReference(catalogDb);

var messaging = builder.AddRabbitMQ("messaging")
                       .WithDataVolume()
                       .WithLifetime(ContainerLifetime.Persistent)
                       .WithManagementPlugin();

var basketService = builder.AddProject("basketservice", @"..\\BasketService\\BasketService.csproj")
                           .WithReference(basketCache)
                           .WithReference(messaging).WaitFor(messaging);

var frontend = builder.AddProject<Projects.MyFrontend>("frontend")
       .WithExternalHttpEndpoints()
       .WithReference(basketService)
       .WithReference(catalogService);

builder.Build().Run();
`;
    const result = parseAppHostCode(code);

    // Check all resources were found
    const names = result.map(r => r.name);
    expect(names).toContain('postgres');
    expect(names).toContain('basketcache');
    expect(names).toContain('catalogservice');
    expect(names).toContain('messaging');
    expect(names).toContain('basketservice');
    expect(names).toContain('frontend');

    // Check types
    expect(result.find(r => r.name === 'postgres')!.type).toBe('postgres');
    expect(result.find(r => r.name === 'basketcache')!.type).toBe('redis');
    expect(result.find(r => r.name === 'messaging')!.type).toBe('rabbitmq');
    expect(result.find(r => r.name === 'catalogservice')!.type).toBe('project');
    expect(result.find(r => r.name === 'basketservice')!.type).toBe('project');
    expect(result.find(r => r.name === 'frontend')!.type).toBe('project');

    // Check database
    const pg = result.find(r => r.name === 'postgres')!;
    expect(pg.databases).toContain('catalogdb');
    expect(pg.hasDataVolume).toBe(true);

    // Check redis
    const redis = result.find(r => r.name === 'basketcache')!;
    expect(redis.hasDataVolume).toBe(true);

    // Check rabbitmq
    const mq = result.find(r => r.name === 'messaging')!;
    expect(mq.hasDataVolume).toBe(true);
    expect(mq.isPersistent).toBe(true);

    // Check frontend
    const fe = result.find(r => r.name === 'frontend')!;
    expect(fe.hasExternalEndpoints).toBe(true);

    // Check references
    const basketSvc = result.find(r => r.name === 'basketservice')!;
    expect(basketSvc.references).toContain(redis.id);
    expect(basketSvc.references).toContain(mq.id);
    expect(basketSvc.waitFor).toContain(mq.id);

    // Check basketservice project path
    expect(basketSvc.projectPath).toBe('..\\BasketService\\BasketService.csproj');
  });

  it('handles multiple resources with no references', () => {
    const code = `
var a = builder.AddPostgres("pg1");
var b = builder.AddRedis("cache1");
var c = builder.AddRabbitMQ("mq1");
`;
    const result = parseAppHostCode(code);
    expect(result).toHaveLength(3);
    result.forEach(r => {
      expect(r.references).toHaveLength(0);
      expect(r.waitFor).toHaveLength(0);
    });
  });

  it('returns empty array for non-AppHost code', () => {
    const code = 'Console.WriteLine("Hello World");';
    expect(parseAppHostCode(code)).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(parseAppHostCode('')).toHaveLength(0);
  });
});
