import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Flex,
  Text,
  Button,
  Card,
  Heading,
  Input,
  IconButton,
  Badge,
  Tabs,
  SimpleGrid,
  Textarea,
} from '@chakra-ui/react';
import { retroCardProps, pixelFontProps } from '../theme/aspireTheme';
import {
  SiPostgresql,
  SiRedis,
  SiMongodb,
  SiRabbitmq,
  SiApachekafka,
  SiPython,
} from 'react-icons/si';
import {
  TbDatabase,
  TbBox,
  TbCode,
  TbTrash,
  TbCopy,
  TbRefresh,
  TbPlus,
  TbLink,
  TbUnlink,
  TbPlayerPlay,
  TbPackage,
  TbFileText,
  TbBrandNodejs,
  TbCloud,
  TbLock,
  TbVariable,
  TbDownload,
  TbUpload,
  TbArrowBackUp,
  TbArrowForwardUp,
  TbShare,
} from 'react-icons/tb';
import type { IconType } from 'react-icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ─── Types ────────────────────────────────────────────────────────────────────

type CodeLanguage = 'csharp' | 'typescript';

type ResourceType =
  | 'postgres'
  | 'redis'
  | 'sqlserver'
  | 'mongodb'
  | 'rabbitmq'
  | 'kafka'
  | 'project'
  | 'container'
  | 'npmapp'
  | 'pythonapp'
  | 'azurestorage'
  | 'keyvault'
  | 'parameter';

interface EnvVar {
  key: string;
  value: string;
}

interface PlaygroundResource {
  id: string;
  type: ResourceType;
  name: string;
  databases: string[];
  image: string;
  references: string[];
  waitFor: string[];
  hasDataVolume: boolean;
  hasExternalEndpoints: boolean;
  ports: string;
  envVars: EnvVar[];
  isPersistent: boolean;
  isSecret: boolean; // for parameter type
  args: string; // for containers
  scriptPath: string; // for python apps
  projectPath: string; // for npm / python relative path
  projectLanguage: CodeLanguage;
}

interface ResourceTemplate {
  type: ResourceType;
  label: string;
  icon: IconType;
  color: string;
  defaultName: string;
  supportsDatabases: boolean;
  category: 'infrastructure' | 'hosting' | 'azure' | 'config';
}

interface LanguageOption {
  id: CodeLanguage;
  label: string;
  icon: string;
  monacoLang: string;
}

interface ProjectScaffoldFile {
  path: string;
  content: string;
  language: string;
}

const LANGUAGES: LanguageOption[] = [
  { id: 'csharp', label: 'C#', icon: '🟣', monacoLang: 'csharp' },
  { id: 'typescript', label: 'TypeScript', icon: '🔷', monacoLang: 'typescript' },
];

// ─── Resource templates ───────────────────────────────────────────────────────

const RESOURCE_TEMPLATES: ResourceTemplate[] = [
  // Infrastructure
  { type: 'postgres', label: 'PostgreSQL', icon: SiPostgresql, color: '#336791', defaultName: 'postgres', supportsDatabases: true, category: 'infrastructure' },
  { type: 'redis', label: 'Redis', icon: SiRedis, color: '#DC382D', defaultName: 'cache', supportsDatabases: false, category: 'infrastructure' },
  { type: 'sqlserver', label: 'SQL Server', icon: TbDatabase, color: '#CC2927', defaultName: 'sqlserver', supportsDatabases: true, category: 'infrastructure' },
  { type: 'mongodb', label: 'MongoDB', icon: SiMongodb, color: '#47A248', defaultName: 'mongodb', supportsDatabases: true, category: 'infrastructure' },
  { type: 'rabbitmq', label: 'RabbitMQ', icon: SiRabbitmq, color: '#FF6600', defaultName: 'rabbitmq', supportsDatabases: false, category: 'infrastructure' },
  { type: 'kafka', label: 'Kafka', icon: SiApachekafka, color: '#999', defaultName: 'kafka', supportsDatabases: false, category: 'infrastructure' },
  // Hosting
  { type: 'project', label: '.NET Project', icon: TbCode, color: '#6B4FBB', defaultName: 'myservice', supportsDatabases: false, category: 'hosting' },
  { type: 'container', label: 'Container', icon: TbBox, color: '#2496ED', defaultName: 'mycontainer', supportsDatabases: false, category: 'hosting' },
  { type: 'npmapp', label: 'Vite / JS App', icon: TbBrandNodejs, color: '#68A063', defaultName: 'frontend', supportsDatabases: false, category: 'hosting' },
  { type: 'pythonapp', label: 'Python (Uvicorn)', icon: SiPython, color: '#3776AB', defaultName: 'pyworker', supportsDatabases: false, category: 'hosting' },
  // Azure
  { type: 'azurestorage', label: 'Azure Storage', icon: TbCloud, color: '#0078D4', defaultName: 'storage', supportsDatabases: false, category: 'azure' },
  { type: 'keyvault', label: 'Key Vault', icon: TbLock, color: '#0078D4', defaultName: 'keyvault', supportsDatabases: false, category: 'azure' },
  // Config
  { type: 'parameter', label: 'Parameter', icon: TbVariable, color: '#E8912D', defaultName: 'my-param', supportsDatabases: false, category: 'config' },
];

const CATEGORIES: { key: ResourceTemplate['category']; label: string }[] = [
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'hosting', label: 'Hosting' },
  { key: 'azure', label: 'Azure' },
  { key: 'config', label: 'Config' },
];

// ─── Pre-built examples ──────────────────────────────────────────────────────

interface Example {
  name: string;
  resources: PlaygroundResource[];
}

function makeId(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeResource(overrides: Partial<PlaygroundResource> & { id: string; type: ResourceType; name: string }): PlaygroundResource {
  return {
    databases: [],
    image: '',
    references: [],
    waitFor: [],
    hasDataVolume: false,
    hasExternalEndpoints: false,
    ports: '',
    envVars: [],
    isPersistent: false,
    isSecret: false,
    args: '',
    scriptPath: '',
    projectPath: '',
    projectLanguage: 'csharp',
    ...overrides,
  };
}

function buildExamples(): Example[] {
  const ecomIds = { pg: makeId(), cache: makeId(), mq: makeId(), api: makeId(), web: makeId() };
  const ecommerce: Example = {
    name: 'E-Commerce',
    resources: [
      makeResource({ id: ecomIds.pg, type: 'postgres', name: 'postgres', databases: ['catalogdb'], hasDataVolume: true }),
      makeResource({ id: ecomIds.cache, type: 'redis', name: 'cache' }),
      makeResource({ id: ecomIds.mq, type: 'rabbitmq', name: 'messaging' }),
      makeResource({ id: ecomIds.api, type: 'project', name: 'api', references: [ecomIds.pg, ecomIds.cache, ecomIds.mq], waitFor: [ecomIds.pg, ecomIds.cache] }),
      makeResource({ id: ecomIds.web, type: 'project', name: 'web', references: [ecomIds.api], waitFor: [ecomIds.api], hasExternalEndpoints: true }),
    ],
  };

  const fsIds = { pg: makeId(), cache: makeId(), api: makeId(), frontend: makeId() };
  const fullstack: Example = {
    name: 'Full Stack',
    resources: [
      makeResource({ id: fsIds.pg, type: 'postgres', name: 'postgres', databases: ['appdb'], hasDataVolume: true }),
      makeResource({ id: fsIds.cache, type: 'redis', name: 'cache' }),
      makeResource({ id: fsIds.api, type: 'project', name: 'api', references: [fsIds.pg, fsIds.cache], waitFor: [fsIds.pg, fsIds.cache] }),
      makeResource({ id: fsIds.frontend, type: 'npmapp', name: 'frontend', projectPath: '../frontend', references: [fsIds.api], waitFor: [fsIds.api], hasExternalEndpoints: true }),
    ],
  };

  const mlIds = { redis: makeId(), pg: makeId(), trainer: makeId(), api: makeId(), minio: makeId() };
  const mlPipeline: Example = {
    name: 'ML Pipeline',
    resources: [
      makeResource({ id: mlIds.pg, type: 'postgres', name: 'metadata-db', databases: ['experiments'], hasDataVolume: true }),
      makeResource({ id: mlIds.redis, type: 'redis', name: 'job-queue' }),
      makeResource({ id: mlIds.minio, type: 'container', name: 'model-store', image: 'minio/minio', ports: '9000', args: 'server /data', envVars: [{ key: 'MINIO_ROOT_USER', value: 'admin' }, { key: 'MINIO_ROOT_PASSWORD', value: 'password' }] }),
      makeResource({ id: mlIds.trainer, type: 'pythonapp', name: 'trainer', scriptPath: 'main:app', projectPath: '../ml-trainer', references: [mlIds.redis, mlIds.pg], waitFor: [mlIds.pg] }),
      makeResource({ id: mlIds.api, type: 'project', name: 'inference-api', references: [mlIds.redis, mlIds.minio], hasExternalEndpoints: true }),
    ],
  };

  const saasIds = { pg: makeId(), redis: makeId(), blob: makeId(), kv: makeId(), dbPwd: makeId(), auth: makeId(), api: makeId() };
  const saas: Example = {
    name: 'SaaS App',
    resources: [
      makeResource({ id: saasIds.dbPwd, type: 'parameter', name: 'db-password', isSecret: true }),
      makeResource({ id: saasIds.pg, type: 'postgres', name: 'postgres', databases: ['tenantdb'], hasDataVolume: true }),
      makeResource({ id: saasIds.redis, type: 'redis', name: 'cache' }),
      makeResource({ id: saasIds.blob, type: 'azurestorage', name: 'storage' }),
      makeResource({ id: saasIds.kv, type: 'keyvault', name: 'secrets' }),
      makeResource({ id: saasIds.auth, type: 'project', name: 'auth-service', references: [saasIds.pg, saasIds.kv] }),
      makeResource({ id: saasIds.api, type: 'project', name: 'tenant-api', references: [saasIds.pg, saasIds.redis, saasIds.blob, saasIds.auth], hasExternalEndpoints: true }),
    ],
  };

  return [ecommerce, fullstack, mlPipeline, saas];
}

// ─── Code generation ─────────────────────────────────────────────────────────

const CS_ADD: Record<ResourceType, string> = {
  postgres: 'AddPostgres',
  redis: 'AddRedis',
  sqlserver: 'AddSqlServer',
  mongodb: 'AddMongoDB',
  rabbitmq: 'AddRabbitMQ',
  kafka: 'AddKafka',
  project: 'AddProject',
  container: 'AddContainer',
  npmapp: 'AddViteApp',
  pythonapp: 'AddUvicornApp',
  azurestorage: 'AddAzureStorage',
  keyvault: 'AddAzureKeyVault',
  parameter: 'AddParameter',
};

const TS_ADD: Record<ResourceType, string> = {
  postgres: 'addPostgres',
  redis: 'addRedis',
  sqlserver: 'addSqlServer',
  mongodb: 'addMongoDB',
  rabbitmq: 'addRabbitMQ',
  kafka: 'addKafka',
  project: 'addProject',
  container: 'addContainer',
  npmapp: 'addViteApp',
  pythonapp: 'addUvicornApp',
  azurestorage: 'addAzureStorage',
  keyvault: 'addAzureKeyVault',
  parameter: 'addParameter',
};

function toVarName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^[0-9]/, '_$&')
    .replace(/_+/g, '_')
    .replace(/_$/, '') || 'resource';
}

function assignVarNames(resources: PlaygroundResource[]): Map<string, string> {
  const idToVar = new Map<string, string>();
  const usedVars = new Set<string>();
  for (const r of resources) {
    let v = toVarName(r.name);
    if (usedVars.has(v)) {
      let i = 2;
      while (usedVars.has(`${v}${i}`)) i++;
      v = `${v}${i}`;
    }
    usedVars.add(v);
    idToVar.set(r.id, v);
  }
  return idToVar;
}

function generateCSharpCode(resources: PlaygroundResource[]): string {
  if (resources.length === 0) {
    return `var builder = DistributedApplication.CreateBuilder(args);

// 👈 Add resources from the palette to get started!

builder.Build().Run();
`;
  }

  const idToVar = assignVarNames(resources);
  const lines: string[] = ['var builder = DistributedApplication.CreateBuilder(args);', ''];

  for (const r of resources) {
    const varName = idToVar.get(r.id)!;
    const method = CS_ADD[r.type];
    const parts: string[] = [];

    // Opening call with type-specific args
    if (r.type === 'container') {
      parts.push(`var ${varName} = builder.${method}("${r.name}", "${r.image || 'myregistry/myimage'}")`);
    } else if (r.type === 'npmapp') {
      parts.push(`var ${varName} = builder.${method}("${r.name}", "${r.projectPath || '../' + r.name}")`);
    } else if (r.type === 'pythonapp') {
      parts.push(`var ${varName} = builder.${method}("${r.name}", "${r.projectPath || '../' + r.name}", "${r.scriptPath || 'main:app'}")`);
    } else if (r.type === 'parameter') {
      parts.push(`var ${varName} = builder.${method}("${r.name}"${r.isSecret ? ', secret: true' : ''})`);
    } else if (r.type === 'project') {
      parts.push(`var ${varName} = builder.AddProject<Projects.${toPascalCase(r.name)}>("${r.name}")`);
    } else {
      parts.push(`var ${varName} = builder.${method}("${r.name}")`);
    }

    // Data volume
    if (r.hasDataVolume && !isAppType(r.type) && r.type !== 'parameter') {
      parts.push('    .WithDataVolume()');
    }

    // Persistent lifetime
    if (r.isPersistent && r.type !== 'parameter') {
      parts.push('    .WithLifetime(ContainerLifetime.Persistent)');
    }

    // External endpoints
    if (r.hasExternalEndpoints) {
      if (r.type === 'project') {
        parts.push('    .WithExternalHttpEndpoints()');
      } else if (r.type === 'npmapp') {
        parts.push('    .WithHttpEndpoint(env: "PORT")');
      } else if (r.type === 'pythonapp') {
        parts.push(`    .WithHttpEndpoint(${r.ports ? `port: ${r.ports}, ` : ''}env: "PORT")`);
      } else if (r.type === 'container' && r.ports) {
        parts.push(`    .WithHttpEndpoint(targetPort: ${r.ports})`);
      }
    }

    // Container args
    if (r.type === 'container' && r.args) {
      const argParts = r.args.split(/\s+/).map((a) => `"${a}"`).join(', ');
      parts.push(`    .WithArgs(${argParts})`);
    }

    // Environment variables
    for (const env of r.envVars) {
      if (env.key && env.value) {
        parts.push(`    .WithEnvironment("${env.key}", "${env.value}")`);
      }
    }

    // References
    for (const refId of r.references) {
      const refResource = resources.find((x) => x.id === refId);
      if (!refResource) continue;
      const refVar = idToVar.get(refId)!;
      if (refResource.databases.length > 0) {
        parts.push(`    .WithReference(${toVarName(refResource.databases[0])})`);
      } else if (refResource.type === 'azurestorage') {
        parts.push(`    .WithReference(${refVar}Blobs)`);
      } else {
        parts.push(`    .WithReference(${refVar})`);
      }
    }

    // WaitFor
    for (const wfId of r.waitFor) {
      const wfVar = idToVar.get(wfId);
      if (wfVar) parts.push(`    .WaitFor(${wfVar})`);
    }

    lines.push(parts.join('\n') + ';');

    // Databases
    for (const db of r.databases) {
      const dbVar = toVarName(db);
      lines.push(`var ${dbVar} = ${varName}.AddDatabase("${db}");`);
    }

    // Azure storage → blobs
    if (r.type === 'azurestorage') {
      lines.push(`var ${varName}Blobs = ${varName}.AddBlobs("blobs");`);
    }

    lines.push('');
  }

  lines.push('builder.Build().Run();');
  return lines.join('\n');
}

function generateTypeScriptCode(resources: PlaygroundResource[]): string {
  if (resources.length === 0) {
    return `import { DistributedApplication } from '@aspire/hosting';

const builder = DistributedApplication.createBuilder();

// 👈 Add resources from the palette to get started!

builder.build().run();
`;
  }

  const idToVar = assignVarNames(resources);
  const lines: string[] = [
    `import { DistributedApplication } from '@aspire/hosting';`,
    '',
    'const builder = DistributedApplication.createBuilder();',
    '',
  ];

  for (const r of resources) {
    const varName = idToVar.get(r.id)!;
    const method = TS_ADD[r.type];
    const parts: string[] = [];

    if (r.type === 'container') {
      parts.push(`const ${varName} = builder.${method}("${r.name}", "${r.image || 'myregistry/myimage'}")`);
    } else if (r.type === 'npmapp') {
      parts.push(`const ${varName} = builder.${method}("${r.name}", "${r.projectPath || '../' + r.name}")`);
    } else if (r.type === 'pythonapp') {
      parts.push(`const ${varName} = builder.${method}("${r.name}", "${r.projectPath || '../' + r.name}", "${r.scriptPath || 'main:app'}")`);
    } else if (r.type === 'parameter') {
      parts.push(`const ${varName} = builder.${method}("${r.name}"${r.isSecret ? ', { secret: true }' : ''})`);
    } else {
      parts.push(`const ${varName} = builder.${method}("${r.name}")`);
    }

    if (r.hasDataVolume && !isAppType(r.type) && r.type !== 'parameter') {
      parts.push('    .withDataVolume()');
    }
    if (r.isPersistent && r.type !== 'parameter') {
      parts.push('    .withLifetime("persistent")');
    }
    if (r.hasExternalEndpoints) {
      if (r.type === 'project') parts.push('    .withExternalHttpEndpoints()');
      else if (r.type === 'npmapp') parts.push('    .withHttpEndpoint({ env: "PORT" })');
      else if (r.type === 'pythonapp') {
        parts.push(`    .withHttpEndpoint({ ${r.ports ? `port: ${r.ports}, ` : ''}env: "PORT" })`);
      } else if (r.type === 'container' && r.ports) {
        parts.push(`    .withHttpEndpoint({ targetPort: ${r.ports} })`);
      }
    }
    if (r.type === 'container' && r.args) {
      const argParts = r.args.split(/\s+/).map((a) => `"${a}"`).join(', ');
      parts.push(`    .withArgs(${argParts})`);
    }
    for (const env of r.envVars) {
      if (env.key && env.value) parts.push(`    .withEnvironment("${env.key}", "${env.value}")`);
    }
    for (const refId of r.references) {
      const refRes = resources.find((x) => x.id === refId);
      if (!refRes) continue;
      const refVar = idToVar.get(refId)!;
      if (refRes.databases.length > 0) parts.push(`    .withReference(${toVarName(refRes.databases[0])})`);
      else if (refRes.type === 'azurestorage') parts.push(`    .withReference(${refVar}Blobs)`);
      else parts.push(`    .withReference(${refVar})`);
    }
    for (const wfId of r.waitFor) {
      const wfVar = idToVar.get(wfId);
      if (wfVar) parts.push(`    .waitFor(${wfVar})`);
    }

    lines.push(parts.join('\n') + ';');
    for (const db of r.databases) {
      lines.push(`const ${toVarName(db)} = ${varName}.addDatabase("${db}");`);
    }
    if (r.type === 'azurestorage') {
      lines.push(`const ${varName}Blobs = ${varName}.addBlobs("blobs");`);
    }
    lines.push('');
  }

  lines.push('builder.build().run();');
  return lines.join('\n');
}

// ─── Scaffold generation ─────────────────────────────────────────────────────

function isAppType(t: ResourceType): boolean {
  return t === 'project' || t === 'npmapp' || t === 'pythonapp' || t === 'container';
}

function toPascalCase(s: string): string {
  return s.replace(/(^|[-_ ])([a-z])/g, (_, __, c: string) => c.toUpperCase()).replace(/[-_ ]/g, '');
}

function generateProjectScaffolds(
  resources: PlaygroundResource[],
): { name: string; lang: string; files: ProjectScaffoldFile[] }[] {
  return resources
    .filter((r) => r.type === 'project' || r.type === 'npmapp' || r.type === 'pythonapp')
    .map((project) => {
      const refs = project.references
        .map((id) => resources.find((r) => r.id === id))
        .filter((r): r is PlaygroundResource => r !== undefined);

      if (project.type === 'npmapp') {
        return { name: project.name, lang: 'Node.js', files: makeNodeScaffold(project.name, refs) };
      }
      if (project.type === 'pythonapp') {
        return { name: project.name, lang: 'Python', files: makePythonScaffold(project.name, project.scriptPath, refs) };
      }
      return { name: project.name, lang: 'C#', files: makeCSharpScaffold(project.name, refs) };
    });
}

function makeNodeScaffold(name: string, refs: PlaygroundResource[]): ProjectScaffoldFile[] {
  const imports: string[] = [];
  const setup: string[] = [];
  const deps: Record<string, string> = { express: '^4.21.0' };

  for (const ref of refs) {
    if (ref.type === 'postgres') {
      imports.push("import pg from 'pg';");
      setup.push(`const pool = new pg.Pool({ connectionString: process.env.ConnectionStrings__${toVarName(ref.databases[0] || ref.name)} });`);
      deps['pg'] = '^8.13.0';
    } else if (ref.type === 'redis') {
      imports.push("import { createClient } from 'redis';");
      setup.push(`const redis = createClient({ url: process.env.ConnectionStrings__${toVarName(ref.name)} });`, 'await redis.connect();');
      deps['redis'] = '^4.7.0';
    } else if (ref.type === 'mongodb') {
      imports.push("import { MongoClient } from 'mongodb';");
      setup.push(`const mongo = new MongoClient(process.env.ConnectionStrings__${toVarName(ref.databases[0] || ref.name)}!);`);
      deps['mongodb'] = '^6.12.0';
    } else if (ref.type === 'rabbitmq') {
      imports.push("import amqplib from 'amqplib';");
      setup.push(`const mq = await amqplib.connect(process.env.ConnectionStrings__${toVarName(ref.name)}!);`);
      deps['amqplib'] = '^0.10.0';
    }
  }

  return [
    {
      path: `${name}/src/index.ts`,
      language: 'typescript',
      content: [
        "import express from 'express';",
        ...imports, '',
        'const app = express();',
        'const port = process.env.PORT ?? 3000;',
        'app.use(express.json());',
        ...(setup.length > 0 ? ['', ...setup] : []),
        '',
        `app.get('/', (_req, res) => res.json({ service: '${name}', status: 'running' }));`,
        `app.get('/health', (_req, res) => res.json({ status: 'healthy' }));`,
        '',
        `app.listen(port, () => console.log(\`${name} listening on \${port}\`));`,
      ].join('\n'),
    },
    {
      path: `${name}/package.json`,
      language: 'json',
      content: JSON.stringify({
        name, version: '1.0.0', type: 'module',
        scripts: { dev: 'tsx watch src/index.ts', build: 'tsc', start: 'node dist/index.js' },
        dependencies: deps,
        devDependencies: { '@types/express': '^5.0.0', '@types/node': '^22.0.0', typescript: '^5.7.0', tsx: '^4.19.0' },
      }, null, 2),
    },
  ];
}

function makePythonScaffold(name: string, scriptPath: string, refs: PlaygroundResource[]): ProjectScaffoldFile[] {
  const imports: string[] = ['import os'];
  const setup: string[] = [];
  const reqs: string[] = ['fastapi', 'uvicorn'];

  for (const ref of refs) {
    if (ref.type === 'postgres') {
      imports.push('import psycopg2');
      setup.push(`db_url = os.environ.get("ConnectionStrings__${toVarName(ref.databases[0] || ref.name)}")`);
      reqs.push('psycopg2-binary');
    } else if (ref.type === 'redis') {
      imports.push('import redis');
      setup.push(`cache = redis.from_url(os.environ.get("ConnectionStrings__${toVarName(ref.name)}", ""))`);
      reqs.push('redis');
    } else if (ref.type === 'mongodb') {
      imports.push('from pymongo import MongoClient');
      setup.push(`mongo = MongoClient(os.environ.get("ConnectionStrings__${toVarName(ref.databases[0] || ref.name)}"))`);
      reqs.push('pymongo');
    }
  }

  // Extract module name from uvicorn notation (e.g. "main:app" → "main.py")
  const moduleName = (scriptPath || 'main:app').split(':')[0];
  const fileName = `${moduleName}.py`;
  return [
    {
      path: `${name}/${fileName}`,
      language: 'python',
      content: [
        ...imports,
        'from fastapi import FastAPI',
        '',
        'app = FastAPI()',
        ...(setup.length > 0 ? ['', ...setup] : []),
        '',
        '@app.get("/")',
        'def root():',
        `    return {"service": "${name}", "status": "running"}`,
        '',
        '@app.get("/health")',
        'def health():',
        '    return {"status": "healthy"}',
        '',
        'if __name__ == "__main__":',
        '    import uvicorn',
        `    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))`,
      ].join('\n'),
    },
    {
      path: `${name}/requirements.txt`,
      language: 'text',
      content: reqs.join('\n'),
    },
  ];
}

function makeCSharpScaffold(name: string, refs: PlaygroundResource[]): ProjectScaffoldFile[] {
  const packages: string[] = [];
  const services: string[] = [];

  for (const ref of refs) {
    if (ref.type === 'postgres') { packages.push('    <PackageReference Include="Aspire.Npgsql" Version="9.1.0" />'); services.push(`builder.AddNpgsqlDataSource("${ref.databases[0] || ref.name}");`); }
    else if (ref.type === 'redis') { packages.push('    <PackageReference Include="Aspire.StackExchange.Redis.DistributedCaching" Version="9.1.0" />'); services.push(`builder.AddRedisDistributedCache("${ref.name}");`); }
    else if (ref.type === 'mongodb') { packages.push('    <PackageReference Include="Aspire.MongoDB.Driver" Version="9.1.0" />'); services.push(`builder.AddMongoDBClient("${ref.databases[0] || ref.name}");`); }
    else if (ref.type === 'rabbitmq') { packages.push('    <PackageReference Include="Aspire.RabbitMQ.Client" Version="9.1.0" />'); services.push(`builder.AddRabbitMQClient("${ref.name}");`); }
    else if (ref.type === 'kafka') { packages.push('    <PackageReference Include="Aspire.Confluent.Kafka" Version="9.1.0" />'); services.push(`builder.AddKafkaProducer<string, string>("${ref.name}");`); }
    else if (ref.type === 'sqlserver') { packages.push('    <PackageReference Include="Aspire.Microsoft.Data.SqlClient" Version="9.1.0" />'); services.push(`builder.AddSqlServerClient("${ref.databases[0] || ref.name}");`); }
    else if (ref.type === 'azurestorage') { packages.push('    <PackageReference Include="Aspire.Azure.Storage.Blobs" Version="9.1.0" />'); services.push(`builder.AddAzureBlobClient("blobs");`); }
    else if (ref.type === 'keyvault') { packages.push('    <PackageReference Include="Aspire.Azure.Security.KeyVault" Version="9.1.0" />'); services.push(`builder.AddAzureKeyVaultClient("${ref.name}");`); }
  }

  return [
    {
      path: `${toPascalCase(name)}/Program.cs`,
      language: 'csharp',
      content: [
        'var builder = WebApplication.CreateBuilder(args);',
        '', 'builder.AddServiceDefaults();',
        ...(services.length > 0 ? ['', ...services] : []),
        '', 'var app = builder.Build();', '', 'app.MapDefaultEndpoints();',
        '', `app.MapGet("/", () => Results.Json(new { service = "${name}", status = "running" }));`,
        '', 'app.Run();',
      ].join('\n'),
    },
    {
      path: `${toPascalCase(name)}/${toPascalCase(name)}.csproj`,
      language: 'xml',
      content: [
        '<Project Sdk="Microsoft.NET.Sdk.Web">', '',
        '  <PropertyGroup>', '    <TargetFramework>net9.0</TargetFramework>',
        '    <ImplicitUsings>enable</ImplicitUsings>', '    <Nullable>enable</Nullable>',
        '  </PropertyGroup>', '', '  <ItemGroup>',
        '    <ProjectReference Include="../ServiceDefaults/ServiceDefaults.csproj" />',
        ...packages, '  </ItemGroup>', '', '</Project>',
      ].join('\n'),
    },
  ];
}

// ─── Import parser ───────────────────────────────────────────────────────────

const METHOD_TO_TYPE: Record<string, ResourceType> = {
  AddPostgres: 'postgres', AddRedis: 'redis', AddSqlServer: 'sqlserver',
  AddMongoDB: 'mongodb', AddRabbitMQ: 'rabbitmq', AddKafka: 'kafka',
  AddProject: 'project', AddContainer: 'container',
  AddViteApp: 'npmapp', AddJavaScriptApp: 'npmapp', AddNodeApp: 'npmapp',
  AddUvicornApp: 'pythonapp', AddUvApp: 'pythonapp',
  AddAzureStorage: 'azurestorage', AddAzureKeyVault: 'keyvault',
  AddParameter: 'parameter',
};

function parseAppHostCode(code: string): PlaygroundResource[] {
  const resources: PlaygroundResource[] = [];
  const varToId = new Map<string, string>();

  // Match: var <varName> = builder.<Method>("<name>"...)
  const addRegex = /(?:var|const)\s+(\w+)\s*=\s*builder\.(\w+)\s*(?:<[^>]+>)?\s*\("([^"]+)"(?:\s*,\s*"([^"]*)")?/g;
  let match;
  while ((match = addRegex.exec(code)) !== null) {
    const [, varName, method, name, secondArg] = match;
    const type = METHOD_TO_TYPE[method];
    if (!type) continue;

    const id = makeId();
    varToId.set(varName, id);

    const r = makeResource({ id, type, name });
    if (type === 'container' && secondArg) r.image = secondArg;
    if ((type === 'npmapp') && secondArg) r.projectPath = secondArg;
    if (type === 'pythonapp' && secondArg) r.projectPath = secondArg;
    if (type === 'parameter' && code.includes(`${varName}`) && /secret\s*:\s*true/i.test(code.substring(match.index, match.index + 200))) {
      r.isSecret = true;
    }
    resources.push(r);
  }

  // Match: .AddDatabase("<name>")
  const dbRegex = /(\w+)\.AddDatabase\s*\("([^"]+)"\)/g;
  while ((match = dbRegex.exec(code)) !== null) {
    const [, parentVar, dbName] = match;
    const parentId = varToId.get(parentVar);
    if (parentId) {
      const parent = resources.find((r) => r.id === parentId);
      if (parent) parent.databases.push(dbName);
    }
  }

  // Match: .WithReference(<var>) and .WaitFor(<var>)
  const chainRegex = /(\w+)(?:\.[\w<>]+\([^)]*\))*\.(WithReference|WaitFor)\((\w+)\)/g;
  while ((match = chainRegex.exec(code)) !== null) {
    const [, consumerVar, method, depVar] = match;
    const consumerId = varToId.get(consumerVar);
    const depId = varToId.get(depVar);
    if (!consumerId || !depId) continue;
    const consumer = resources.find((r) => r.id === consumerId);
    if (!consumer) continue;
    if (method === 'WithReference' && !consumer.references.includes(depId)) {
      consumer.references.push(depId);
    }
    if (method === 'WaitFor' && !consumer.waitFor.includes(depId)) {
      consumer.waitFor.push(depId);
    }
  }

  // Match: .WithDataVolume()
  for (const r of resources) {
    const varName = [...varToId.entries()].find(([, id]) => id === r.id)?.[0];
    if (varName && new RegExp(`${varName}[^;]*\\.WithDataVolume`).test(code)) r.hasDataVolume = true;
    if (varName && new RegExp(`${varName}[^;]*\\.WithLifetime\\(ContainerLifetime\\.Persistent\\)`).test(code)) r.isPersistent = true;
    if (varName && new RegExp(`${varName}[^;]*\\.WithExternalHttpEndpoints`).test(code)) r.hasExternalEndpoints = true;
    if (varName && new RegExp(`${varName}[^;]*\\.WithHttpEndpoint`).test(code)) r.hasExternalEndpoints = true;
  }

  return resources;
}

// ─── localStorage persistence ────────────────────────────────────────────────

const STORAGE_KEY = 'aspire-playground-resources';

function saveToStorage(resources: PlaygroundResource[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(resources)); } catch { /* quota */ }
}

function loadFromStorage(): PlaygroundResource[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

// ─── Validation ──────────────────────────────────────────────────────────────

interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  message: string;
  resourceId?: string;
}

// ─── Share via URL ───────────────────────────────────────────────────────────

function encodeState(resources: PlaygroundResource[]): string {
  const compact = resources.map((r, _i, arr) => {
    const c: Record<string, unknown> = { t: r.type, n: r.name };
    if (r.databases.length) c.d = r.databases;
    if (r.references.length) c.r = r.references.map(ref => arr.findIndex(x => x.id === ref));
    if (r.waitFor.length) c.w = r.waitFor.map(ref => arr.findIndex(x => x.id === ref));
    if (r.image) c.i = r.image;
    if (r.ports) c.p = r.ports;
    if (r.hasDataVolume) c.v = 1;
    if (r.hasExternalEndpoints) c.e = 1;
    if (r.envVars.length) c.ev = r.envVars;
    if (r.isPersistent) c.ps = 1;
    if (r.isSecret) c.s = 1;
    if (r.args) c.a = r.args;
    if (r.scriptPath) c.sp = r.scriptPath;
    if (r.projectPath) c.pp = r.projectPath;
    if (r.projectLanguage !== 'csharp') c.pl = r.projectLanguage;
    return c;
  });
  return btoa(JSON.stringify(compact));
}

function decodeState(hash: string): PlaygroundResource[] | null {
  try {
    const compact = JSON.parse(atob(hash)) as Record<string, unknown>[];
    if (!Array.isArray(compact)) return null;
    const ids = compact.map(() => makeId());
    return compact.map((c, i) =>
      makeResource({
        id: ids[i],
        type: c.t as ResourceType,
        name: c.n as string,
        databases: (c.d as string[] | undefined) ?? [],
        image: (c.i as string | undefined) ?? '',
        references: ((c.r as number[] | undefined) ?? []).filter(idx => idx >= 0 && idx < ids.length).map(idx => ids[idx]),
        waitFor: ((c.w as number[] | undefined) ?? []).filter(idx => idx >= 0 && idx < ids.length).map(idx => ids[idx]),
        ports: (c.p as string | undefined) ?? '',
        hasDataVolume: c.v === 1,
        hasExternalEndpoints: c.e === 1,
        envVars: (c.ev as EnvVar[] | undefined) ?? [],
        isPersistent: c.ps === 1,
        isSecret: c.s === 1,
        args: (c.a as string | undefined) ?? '',
        scriptPath: (c.sp as string | undefined) ?? '',
        projectPath: (c.pp as string | undefined) ?? '',
        projectLanguage: (c.pl as CodeLanguage | undefined) ?? 'csharp',
      }),
    );
  } catch {
    return null;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlaygroundPage() {
  useEffect(() => { document.title = 'Playground | Aspire Learn'; }, []);
  // Load initial resources from URL hash (priority) or localStorage
  const [resources, setResources] = useState<PlaygroundResource[]>(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const decoded = decodeState(hash);
      if (decoded) return decoded;
    }
    return loadFromStorage() ?? [];
  });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<CodeLanguage>('csharp');
  const [showScaffolds, setShowScaffolds] = useState(false);
  const [activeTab, setActiveTab] = useState('canvas');
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [highlightedResource, setHighlightedResource] = useState<string | null>(null);

  // Undo/redo history — uses refs for index/history to avoid stale closures
  const MAX_HISTORY = 50;
  const historyRef = useRef<PlaygroundResource[][]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const snapshotResources = useCallback((res: PlaygroundResource[]) =>
    res.map(r => ({ ...r, envVars: [...r.envVars], databases: [...r.databases], references: [...r.references], waitFor: [...r.waitFor] })), []);

  // Auto-push to history whenever resources change (skip if triggered by undo/redo)
  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      return;
    }
    const snap = snapshotResources(resources);
    const h = historyRef.current;
    const idx = historyIndexRef.current;
    // Skip if resources match the current history entry (avoids strict-mode double-fire)
    const current = h[idx];
    if (current && JSON.stringify(current) === JSON.stringify(snap)) return;
    const truncated = h.slice(0, idx + 1);
    truncated.push(snap);
    if (truncated.length > MAX_HISTORY) truncated.shift();
    historyRef.current = truncated;
    historyIndexRef.current = truncated.length - 1;
    setCanUndo(truncated.length > 1);
    setCanRedo(false);
  }, [resources, snapshotResources]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current--;
    const target = historyRef.current[historyIndexRef.current];
    if (target) setResources(snapshotResources(target));
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, [snapshotResources]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current++;
    const target = historyRef.current[historyIndexRef.current];
    if (target) setResources(snapshotResources(target));
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, [snapshotResources]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // SVG connection overlay refs
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [connectionLines, setConnectionLines] = useState<{ fromId: string; toId: string; type: 'reference' | 'waitFor' }[]>([]);
  const [cardPositions, setCardPositions] = useState<Map<string, DOMRect>>(new Map());
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Persist to localStorage on every change
  useEffect(() => { saveToStorage(resources); }, [resources]);

  const examples = useMemo(() => buildExamples(), []);

  const generatedCode = useMemo(
    () => activeLanguage === 'typescript' ? generateTypeScriptCode(resources) : generateCSharpCode(resources),
    [resources, activeLanguage],
  );

  const scaffolds = useMemo(() => generateProjectScaffolds(resources), [resources]);

  const addResource = useCallback((type: ResourceType) => {
    const tmpl = RESOURCE_TEMPLATES.find((t) => t.type === type)!;
    let name = tmpl.defaultName;
    const existing = resources.filter((r) => r.type === type);
    if (existing.length > 0) name = `${tmpl.defaultName}${existing.length + 1}`;
    setResources((prev) => [...prev, makeResource({
      id: makeId(),
      type,
      name,
      image: type === 'container' ? 'myregistry/myimage' : '',
      scriptPath: type === 'pythonapp' ? 'main:app' : '',
      projectPath: type === 'npmapp' || type === 'pythonapp' ? `../${name}` : '',
    })]);
  }, [resources]);

  const updateResource = useCallback((id: string, updates: Partial<PlaygroundResource>) => {
    setResources((prev) => prev.map((r) => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const removeResource = useCallback((id: string) => {
    setResources((prev) =>
      prev.filter((r) => r.id !== id).map((r) => ({
        ...r,
        references: r.references.filter((ref) => ref !== id),
        waitFor: r.waitFor.filter((wf) => wf !== id),
      })),
    );
    if (connectingFrom === id) setConnectingFrom(null);
  }, [connectingFrom]);

  const toggleReference = useCallback((fromId: string, toId: string) => {
    setResources((prev) => prev.map((r) => {
      if (r.id !== fromId) return r;
      const hasRef = r.references.includes(toId);
      return {
        ...r,
        references: hasRef ? r.references.filter((x) => x !== toId) : [...r.references, toId],
      };
    }));
  }, []);

  const toggleWaitFor = useCallback((fromId: string, toId: string) => {
    setResources((prev) => prev.map((r) => {
      if (r.id !== fromId) return r;
      const has = r.waitFor.includes(toId);
      return { ...r, waitFor: has ? r.waitFor.filter((x) => x !== toId) : [...r.waitFor, toId] };
    }));
  }, []);

  const addDatabase = useCallback((id: string) => {
    setResources((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      return { ...r, databases: [...r.databases, `db${r.databases.length + 1}`] };
    }));
  }, []);

  const removeDatabase = useCallback((id: string, dbIndex: number) => {
    setResources((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      return { ...r, databases: r.databases.filter((_, i) => i !== dbIndex) };
    }));
  }, []);

  const updateDatabase = useCallback((id: string, dbIndex: number, value: string) => {
    setResources((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const dbs = [...r.databases];
      dbs[dbIndex] = value;
      return { ...r, databases: dbs };
    }));
  }, []);

  const addEnvVar = useCallback((id: string) => {
    setResources((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      return { ...r, envVars: [...r.envVars, { key: '', value: '' }] };
    }));
  }, []);

  const removeEnvVar = useCallback((id: string, idx: number) => {
    setResources((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      return { ...r, envVars: r.envVars.filter((_, i) => i !== idx) };
    }));
  }, []);

  const updateEnvVar = useCallback((id: string, idx: number, field: 'key' | 'value', val: string) => {
    setResources((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const envVars = [...r.envVars];
      envVars[idx] = { ...envVars[idx], [field]: val };
      return { ...r, envVars };
    }));
  }, []);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [generatedCode]);

  const reset = useCallback(() => {
    setResources([]);
    setConnectingFrom(null);
  }, []);

  const loadExample = useCallback((example: Example) => {
    setResources(example.resources.map((r) => ({ ...r })));
    setConnectingFrom(null);
  }, []);

  const handleConnect = useCallback((resourceId: string) => {
    if (connectingFrom === null) setConnectingFrom(resourceId);
    else if (connectingFrom === resourceId) setConnectingFrom(null);
    else {
      // Connect adds both WithReference and WaitFor by default
      toggleReference(connectingFrom, resourceId);
      toggleWaitFor(connectingFrom, resourceId);
      setConnectingFrom(null);
    }
  }, [connectingFrom, toggleReference, toggleWaitFor]);

  const getResourceName = useCallback((id: string) =>
    resources.find((r) => r.id === id)?.name ?? id, [resources]);

  const findTemplate = useCallback((type: ResourceType) =>
    RESOURCE_TEMPLATES.find((t) => t.type === type)!, []);

  const nameWarnings = useMemo(() => {
    const warnings: string[] = [];
    const names = resources.map((r) => r.name);
    for (const r of resources) {
      if (!r.name.trim()) warnings.push(`Resource has an empty name`);
      if (names.filter((n) => n === r.name).length > 1) warnings.push(`Duplicate name: "${r.name}"`);
    }
    return [...new Set(warnings)];
  }, [resources]);

  const downloadCode = useCallback(() => {
    const filename = activeLanguage === 'typescript' ? 'apphost.ts' : 'Program.cs';
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedCode, activeLanguage]);

  const handleImport = useCallback(() => {
    const parsed = parseAppHostCode(importText);
    if (parsed.length > 0) {
      setResources(parsed);
      setShowImport(false);
      setImportText('');
      setActiveTab('canvas');
    }
  }, [importText]);

  // Share via URL
  const shareState = useCallback(async () => {
    try {
      const encoded = encodeState(resources);
      window.location.hash = encoded;
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch { /* ignore */ }
  }, [resources]);

  // Live validation
  const validationIssues = useMemo(() => {
    const issues: ValidationIssue[] = [];
    const names = resources.map(r => r.name);

    for (const r of resources) {
      if (!r.name.trim()) {
        issues.push({ level: 'error', message: 'Resource needs a name', resourceId: r.id });
      }
      if (r.name.trim() && names.filter(n => n === r.name).length > 1) {
        issues.push({ level: 'error', message: `Duplicate resource name "${r.name}"`, resourceId: r.id });
      }
      if (r.type === 'container' && !r.image) {
        issues.push({ level: 'warning', message: `Container "${r.name || '(unnamed)'}" needs a Docker image`, resourceId: r.id });
      }
      const hasRefsTo = r.references.length > 0 || r.waitFor.length > 0;
      const hasRefsFrom = resources.some(other => other.references.includes(r.id) || other.waitFor.includes(r.id));
      if (!hasRefsTo && !hasRefsFrom && resources.length > 1) {
        issues.push({ level: 'warning', message: `"${r.name || '(unnamed)'}" isn't connected to anything`, resourceId: r.id });
      }
      const isApp = r.type === 'project' || r.type === 'npmapp' || r.type === 'pythonapp';
      const hasInfraRef = r.references.some(refId => {
        const target = resources.find(x => x.id === refId);
        return target && ['postgres', 'redis', 'sqlserver', 'mongodb', 'rabbitmq', 'kafka'].includes(target.type);
      });
      if (isApp && !hasInfraRef && resources.some(x => ['postgres', 'redis', 'sqlserver', 'mongodb'].includes(x.type))) {
        issues.push({ level: 'info', message: `Consider adding a database reference to "${r.name}"`, resourceId: r.id });
      }
    }
    return issues;
  }, [resources]);

  // SVG connection overlay: compute positions
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updatePositions = () => {
      const positions = new Map<string, DOMRect>();
      const containerRect = container.getBoundingClientRect();
      for (const r of resources) {
        const el = container.querySelector(`[data-resource-id="${r.id}"]`);
        if (el) {
          const rect = el.getBoundingClientRect();
          positions.set(r.id, new DOMRect(
            rect.left - containerRect.left,
            rect.top - containerRect.top,
            rect.width,
            rect.height,
          ));
        }
      }
      setCardPositions(positions);

      const lines: { fromId: string; toId: string; type: 'reference' | 'waitFor' }[] = [];
      for (const r of resources) {
        for (const refId of r.references) {
          lines.push({ fromId: r.id, toId: refId, type: 'reference' });
        }
        for (const wfId of r.waitFor) {
          if (!r.references.includes(wfId)) {
            lines.push({ fromId: r.id, toId: wfId, type: 'waitFor' });
          }
        }
      }
      setConnectionLines(lines);
    };

    updatePositions();
    const observer = new ResizeObserver(updatePositions);
    observer.observe(container);
    return () => observer.disconnect();
  }, [resources]);

  // Track mouse for connect mode line
  const mousePosNeeded = !!connectingFrom;
  useEffect(() => {
    if (!mousePosNeeded || !canvasContainerRef.current) {
      return;
    }
    const container = canvasContainerRef.current;
    const handler = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
    container.addEventListener('mousemove', handler);
    return () => {
      container.removeEventListener('mousemove', handler);
      setMousePos(null);
    };
  }, [mousePosNeeded]);

  return (
    <Box maxW="1600px" mx="auto" px={{ base: '4', md: '6' }} py="6" data-testid="playground-page">
      {/* Header */}
      <Flex justify="space-between" align="flex-start" mb="6" flexWrap="wrap" gap="4">
        <Box>
          <Heading as="h1" size="xl" color="dark.text" display="flex" alignItems="center" gap="3">
            <Text as="span" fontSize="2xl">🏗️</Text>
            <Text as="span" {...pixelFontProps} fontSize="lg">Architecture Playground</Text>
          </Heading>
          <Text color="dark.muted" fontSize="sm" mt="2" maxW="500px">
            Design your Aspire distributed app — add resources, connect them, and generate AppHost code in C# or TypeScript
          </Text>
        </Box>
        <Flex gap="2" flexWrap="wrap" align="center">
          {examples.map((ex) => (
            <Button
              key={ex.name} size="sm" variant="outline" colorPalette="purple"
              onClick={() => loadExample(ex)}
              data-testid={`example-${ex.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {ex.name}
            </Button>
          ))}
          <Button size="sm" variant="outline" colorPalette="purple" onClick={undo} disabled={!canUndo}
            data-testid="undo-btn" aria-label="Undo"
          >
            <TbArrowBackUp /> Undo
          </Button>
          <Button size="sm" variant="outline" colorPalette="purple" onClick={redo} disabled={!canRedo}
            data-testid="redo-btn" aria-label="Redo"
          >
            <TbArrowForwardUp /> Redo
          </Button>
          <Button size="sm" variant="outline" colorPalette={shareCopied ? 'green' : 'purple'}
            onClick={shareState} data-testid="share-btn" aria-label="Share playground"
          >
            <TbShare /> {shareCopied ? 'Link copied!' : 'Share'}
          </Button>
          <Button size="sm" variant="outline" colorPalette="red" onClick={reset} data-testid="reset-btn">
            <TbRefresh /> Reset
          </Button>
        </Flex>
      </Flex>

      {/* Resource Palette */}
      <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg" mb="6" data-testid="resource-palette" role="region" aria-label="Resource palette">
        <Card.Body p="5">
          <Flex gap="6" flexWrap="wrap">
            {CATEGORIES.map((cat) => (
              <Box key={cat.key} minW="160px">
                <Text {...pixelFontProps} fontSize="2xs" color="aspire.300" mb="3">
                  {cat.label}
                </Text>
                <Flex direction="column" gap="2">
                  {RESOURCE_TEMPLATES.filter((t) => t.category === cat.key).map((tmpl) => (
                    <Button
                      key={tmpl.type} size="sm" variant="outline" colorPalette="purple"
                      justifyContent="flex-start" gap="2"
                      onClick={() => addResource(tmpl.type)}
                      data-testid={`add-${tmpl.type}`}
                      css={{ transition: 'all 0.15s', '&:hover': { transform: 'translateX(3px)' } }}
                    >
                      <Box as={tmpl.icon} color={tmpl.color} />
                      <Text fontSize="xs">{tmpl.label}</Text>
                    </Button>
                  ))}
                </Flex>
              </Box>
            ))}
          </Flex>
        </Card.Body>
      </Card.Root>

      {/* Main area: Tabs for Canvas / Code */}
      <Tabs.Root value={activeTab} onValueChange={(d) => setActiveTab(d.value)}>
        <Tabs.List
          bg="dark.surface" border="2px solid" borderColor="dark.border"
          borderRadius="sm" p="1" gap="1" mb="5"
        >
          <Tabs.Trigger value="canvas"
            fontSize="10px" px="5" py="2" {...pixelFontProps}
            color="dark.muted" _selected={{ bg: 'aspire.200', color: 'aspire.accent' }}
            borderRadius="sm"
          >
            Canvas ({resources.length})
          </Tabs.Trigger>
          <Tabs.Trigger value="code"
            fontSize="10px" px="5" py="2" {...pixelFontProps}
            color="dark.muted" _selected={{ bg: 'aspire.200', color: 'aspire.accent' }}
            borderRadius="sm"
          >
            Code
          </Tabs.Trigger>
        </Tabs.List>

        {/* ── Canvas Tab ───────────────────────────────────────────── */}
        <Tabs.Content value="canvas">
          {connectingFrom && (
            <Badge colorPalette="yellow" variant="solid" {...pixelFontProps} fontSize="2xs" mb="4" role="status" aria-live="polite">
              Click another resource to connect
            </Badge>
          )}

          {resources.length === 0 ? (
            <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg">
              <Card.Body p="5">
                <Flex direction="column" align="center" justify="center" minH="300px" gap="4" data-testid="canvas-empty">
                  <Text fontSize="4xl">+</Text>
                  <Text {...pixelFontProps} fontSize="xs" color="dark.muted" textAlign="center">
                    Add resources from the palette above
                  </Text>
                  <Text fontSize="sm" color="dark.muted" textAlign="center">
                    or load an example to get started
                  </Text>
                </Flex>
              </Card.Body>
            </Card.Root>
          ) : (
            <Box position="relative" ref={canvasContainerRef}>
              {/* SVG connection overlay */}
              <svg
                style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  pointerEvents: 'none', zIndex: 1,
                }}
                data-testid="connection-overlay"
              >
                <defs>
                  <marker id="arrow-ref" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L8,3 L0,6" fill="#7C3AED" />
                  </marker>
                  <marker id="arrow-wf" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <path d="M0,0 L8,3 L0,6" fill="#A78BFA" />
                  </marker>
                </defs>
                {connectionLines.map((line, i) => {
                  const fromRect = cardPositions.get(line.fromId);
                  const toRect = cardPositions.get(line.toId);
                  if (!fromRect || !toRect) return null;
                  const x1 = fromRect.left + fromRect.width / 2;
                  const y1 = fromRect.top + fromRect.height / 2;
                  const x2 = toRect.left + toRect.width / 2;
                  const y2 = toRect.top + toRect.height / 2;
                  const cx = (x1 + x2) / 2;
                  const cy = (y1 + y2) / 2 - 30;
                  const isRef = line.type === 'reference';
                  return (
                    <path
                      key={`${line.fromId}-${line.toId}-${line.type}-${i}`}
                      d={`M${x1},${y1} Q${cx},${cy} ${x2},${y2}`}
                      fill="none"
                      stroke={isRef ? '#7C3AED' : '#A78BFA'}
                      strokeWidth={isRef ? 2 : 1.5}
                      strokeDasharray={isRef ? 'none' : '6,4'}
                      markerEnd={isRef ? 'url(#arrow-ref)' : 'url(#arrow-wf)'}
                      opacity={0.7}
                    />
                  );
                })}
                {connectingFrom && mousePos && (() => {
                  const fromRect = cardPositions.get(connectingFrom);
                  if (!fromRect) return null;
                  const x1 = fromRect.left + fromRect.width / 2;
                  const y1 = fromRect.top + fromRect.height / 2;
                  return (
                    <line
                      x1={x1} y1={y1} x2={mousePos.x} y2={mousePos.y}
                      stroke="#FFD700" strokeWidth={2} strokeDasharray="4,4" opacity={0.8}
                    />
                  );
                })()}
              </svg>

              <SimpleGrid columns={{ base: 1, md: 2, lg: 3, xl: 4 }} gap="5" data-testid="canvas-resources">
                {resources.map((resource) => {
                  const tmpl = findTemplate(resource.type);
                  const isConnecting = connectingFrom === resource.id;
                  const isTarget = connectingFrom !== null && connectingFrom !== resource.id;
                  const isHighlighted = highlightedResource === resource.id;

                  return (
                    <Card.Root
                      key={resource.id} variant="outline" {...retroCardProps}
                      borderColor={isHighlighted ? '#FF6B6B' : isConnecting ? 'game.xpGold' : isTarget ? 'aspire.600' : 'game.pixelBorder'}
                      role="article" aria-label={`${tmpl.label}: ${resource.name}`}
                      data-resource-id={resource.id}
                      tabIndex={isTarget ? 0 : undefined}
                      css={isConnecting ? {
                        animation: 'pulse 1s ease-in-out infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { boxShadow: '4px 4px 0 #FFD700' },
                          '50%': { boxShadow: '4px 4px 0 #FFD700, 0 0 12px rgba(255, 215, 0, 0.4)' },
                        },
                      } : isHighlighted ? {
                        boxShadow: '0 0 12px rgba(255, 107, 107, 0.5)',
                        transition: 'all 0.3s',
                      } : isTarget ? {
                        cursor: 'pointer', transition: 'all 0.15s',
                        '&:hover': { borderColor: '#FFD700', transform: 'scale(1.02)' },
                      } : undefined}
                      onClick={isTarget ? () => handleConnect(resource.id) : undefined}
                      onKeyDown={isTarget ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleConnect(resource.id); } } : undefined}
                      data-testid={`resource-card-${resource.name}`}
                    >
                    <Card.Body p="4" display="flex" flexDirection="column" gap="3">
                      {/* Header */}
                      <Flex justify="space-between" align="center">
                        <Flex align="center" gap="2" minW="0">
                          <Box as={tmpl.icon} color={tmpl.color} fontSize="lg" flexShrink={0} />
                          <Badge colorPalette="purple" variant="subtle" fontSize="2xs">
                            {tmpl.label}
                          </Badge>
                        </Flex>
                        <Flex gap="1">
                          {resource.type !== 'parameter' && (
                            <IconButton aria-label="Connect" size="xs"
                              variant={isConnecting ? 'solid' : 'ghost'}
                              colorPalette={isConnecting ? 'yellow' : 'purple'}
                              onClick={(e) => { e.stopPropagation(); handleConnect(resource.id); }}
                              data-testid={`connect-${resource.name}`}
                            >
                              {isConnecting ? <TbUnlink /> : <TbLink />}
                            </IconButton>
                          )}
                          <IconButton aria-label={`Delete ${resource.name}`} size="xs" variant="ghost" colorPalette="red"
                            onClick={(e) => { e.stopPropagation(); removeResource(resource.id); }}
                            data-testid={`delete-${resource.name}`}
                          >
                            <TbTrash />
                          </IconButton>
                        </Flex>
                      </Flex>

                      {/* Name */}
                      <Input size="sm" value={resource.name}
                        onChange={(e) => updateResource(resource.id, { name: e.target.value })}
                        placeholder="Resource name" onClick={(e) => e.stopPropagation()}
                        aria-label={`Name for ${tmpl.label} resource`}
                        data-testid={`name-input-${resource.name}`}
                        css={{ fontFamily: '"Press Start 2P", monospace', fontSize: '9px' }}
                      />

                      {/* Toggle options */}
                      <Flex gap="1.5" flexWrap="wrap">
                        {!isAppType(resource.type) && resource.type !== 'parameter' && resource.type !== 'azurestorage' && resource.type !== 'keyvault' && (
                          <Button size="xs"
                            variant={resource.hasDataVolume ? 'solid' : 'outline'}
                            colorPalette={resource.hasDataVolume ? 'green' : 'gray'}
                            aria-pressed={resource.hasDataVolume}
                            onClick={(e) => { e.stopPropagation(); updateResource(resource.id, { hasDataVolume: !resource.hasDataVolume }); }}
                            data-testid={`volume-${resource.name}`}
                          >
                            <TbPackage /> Vol
                          </Button>
                        )}
                        {(resource.type === 'project' || resource.type === 'npmapp' || resource.type === 'container' || resource.type === 'pythonapp') && (
                          <Button size="xs"
                            variant={resource.hasExternalEndpoints ? 'solid' : 'outline'}
                            colorPalette={resource.hasExternalEndpoints ? 'green' : 'gray'}
                            aria-pressed={resource.hasExternalEndpoints}
                            onClick={(e) => { e.stopPropagation(); updateResource(resource.id, { hasExternalEndpoints: !resource.hasExternalEndpoints }); }}
                            data-testid={`external-${resource.name}`}
                          >
                            <TbPlayerPlay /> Ext
                          </Button>
                        )}
                        {resource.type !== 'parameter' && resource.type !== 'azurestorage' && resource.type !== 'keyvault' && (
                          <Button size="xs"
                            variant={resource.isPersistent ? 'solid' : 'outline'}
                            colorPalette={resource.isPersistent ? 'blue' : 'gray'}
                            aria-pressed={resource.isPersistent}
                            aria-label="Persistent lifetime"
                            onClick={(e) => { e.stopPropagation(); updateResource(resource.id, { isPersistent: !resource.isPersistent }); }}
                          >
                            💾
                          </Button>
                        )}
                        {resource.type === 'parameter' && (
                          <Button size="xs"
                            variant={resource.isSecret ? 'solid' : 'outline'}
                            colorPalette={resource.isSecret ? 'red' : 'gray'}
                            aria-pressed={resource.isSecret}
                            onClick={(e) => { e.stopPropagation(); updateResource(resource.id, { isSecret: !resource.isSecret }); }}
                          >
                            <TbLock /> Secret
                          </Button>
                        )}
                      </Flex>

                      {/* Type-specific config */}
                      {resource.type === 'container' && (
                        <Flex direction="column" gap="2">
                          <Input size="xs" value={resource.image}
                            onChange={(e) => updateResource(resource.id, { image: e.target.value })}
                            placeholder="Image (e.g. nginx:latest)" onClick={(e) => e.stopPropagation()}
                            aria-label="Container image"
                            data-testid={`image-input-${resource.name}`}
                          />
                          <Flex gap="2">
                            <Input size="xs" value={resource.ports} flex="1"
                              onChange={(e) => updateResource(resource.id, { ports: e.target.value })}
                              placeholder="Port" onClick={(e) => e.stopPropagation()}
                              aria-label="Target port"
                              data-testid={`port-input-${resource.name}`}
                            />
                            <Input size="xs" value={resource.args} flex="1"
                              onChange={(e) => updateResource(resource.id, { args: e.target.value })}
                              placeholder="Args" onClick={(e) => e.stopPropagation()}
                              aria-label="Container arguments"
                            />
                          </Flex>
                        </Flex>
                      )}
                      {resource.type === 'npmapp' && (
                        <Input size="xs" value={resource.projectPath}
                          onChange={(e) => updateResource(resource.id, { projectPath: e.target.value })}
                          placeholder="Path (e.g. ../frontend)" onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      {resource.type === 'pythonapp' && (
                        <Flex gap="2">
                          <Input size="xs" value={resource.projectPath} flex="1"
                            onChange={(e) => updateResource(resource.id, { projectPath: e.target.value })}
                            placeholder="Dir (../ml)" onClick={(e) => e.stopPropagation()}
                            aria-label="Project directory"
                          />
                          <Input size="xs" value={resource.scriptPath} flex="1"
                            onChange={(e) => updateResource(resource.id, { scriptPath: e.target.value })}
                            placeholder="main:app" onClick={(e) => e.stopPropagation()}
                            aria-label="Uvicorn app name"
                          />
                        </Flex>
                      )}

                      {/* Databases */}
                      {tmpl.supportsDatabases && (
                        <Box>
                          <Flex justify="space-between" align="center" mb="1.5">
                            <Text fontSize="2xs" color="dark.muted" fontWeight="bold">DBs</Text>
                            <IconButton aria-label="Add database" size="xs" variant="ghost" colorPalette="purple"
                              onClick={(e) => { e.stopPropagation(); addDatabase(resource.id); }}
                              data-testid={`add-db-${resource.name}`}
                            >
                              <TbPlus />
                            </IconButton>
                          </Flex>
                          {resource.databases.map((db, idx) => (
                            <Flex key={idx} gap="1" mb="1.5" align="center">
                              <Input size="xs" value={db} flex="1"
                                onChange={(e) => { e.stopPropagation(); updateDatabase(resource.id, idx, e.target.value); }}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Database name ${idx + 1}`}
                                data-testid={`db-input-${resource.name}-${idx}`}
                              />
                              <IconButton aria-label={`Remove database ${db}`} size="xs" variant="ghost" colorPalette="red"
                                onClick={(e) => { e.stopPropagation(); removeDatabase(resource.id, idx); }}
                              >
                                <TbTrash />
                              </IconButton>
                            </Flex>
                          ))}
                        </Box>
                      )}

                      {/* Environment variables */}
                      {resource.type !== 'parameter' && resource.envVars.length > 0 && (
                        <Box>
                          <Text fontSize="2xs" color="dark.muted" fontWeight="bold" mb="1">Env</Text>
                          {resource.envVars.map((env, idx) => (
                            <Flex key={idx} gap="1" mb="1" align="center">
                              <Input size="xs" value={env.key} placeholder="KEY" flex="1"
                                onChange={(e) => updateEnvVar(resource.id, idx, 'key', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Environment variable key ${idx + 1}`}
                              />
                              <Text fontSize="2xs" color="dark.muted">=</Text>
                              <Input size="xs" value={env.value} placeholder="val" flex="1"
                                onChange={(e) => updateEnvVar(resource.id, idx, 'value', e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Environment variable value ${idx + 1}`}
                              />
                              <IconButton aria-label={`Remove env var ${env.key}`} size="xs" variant="ghost" colorPalette="red"
                                onClick={(e) => { e.stopPropagation(); removeEnvVar(resource.id, idx); }}
                              >
                                <TbTrash />
                              </IconButton>
                            </Flex>
                          ))}
                        </Box>
                      )}
                      {resource.type !== 'parameter' && (
                        <Button size="xs" variant="ghost" colorPalette="purple"
                          onClick={(e) => { e.stopPropagation(); addEnvVar(resource.id); }}
                          aria-label={`Add environment variable to ${resource.name}`}
                        >
                          <TbPlus /> Env
                        </Button>
                      )}

                      {/* References */}
                      {resource.references.length > 0 && (
                        <Box>
                          <Text fontSize="2xs" color="dark.muted" mb="1">Refs</Text>
                          <Flex gap="1.5" flexWrap="wrap" role="list" aria-label="Referenced resources">
                            {resource.references.map((refId) => (
                              <Badge key={refId} colorPalette="purple" variant="subtle" fontSize="2xs"
                                cursor="pointer" role="listitem" tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); toggleReference(resource.id, refId); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleReference(resource.id, refId); } }}
                                aria-label={`Remove reference to ${getResourceName(refId)}`}
                                data-testid={`ref-badge-${resource.name}-${getResourceName(refId)}`}
                              >
                                🔗 {getResourceName(refId)} ✕
                              </Badge>
                            ))}
                          </Flex>
                        </Box>
                      )}

                      {/* WaitFor */}
                      {resource.waitFor.length > 0 && (
                        <Box>
                          <Text fontSize="2xs" color="dark.muted" mb="1">WaitFor</Text>
                          <Flex gap="1.5" flexWrap="wrap" role="list" aria-label="WaitFor dependencies">
                            {resource.waitFor.map((wfId) => (
                              <Badge key={wfId} colorPalette="blue" variant="subtle" fontSize="2xs"
                                cursor="pointer" role="listitem" tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); toggleWaitFor(resource.id, wfId); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleWaitFor(resource.id, wfId); } }}
                                aria-label={`Remove WaitFor on ${getResourceName(wfId)}`}
                              >
                                ⏳ {getResourceName(wfId)} ✕
                              </Badge>
                            ))}
                          </Flex>
                        </Box>
                      )}

                      {/* Name validation warning */}
                      {!resource.name.trim() && (
                        <Text fontSize="2xs" color="red.400">Name cannot be empty</Text>
                      )}
                    </Card.Body>
                  </Card.Root>
                );
              })}
            </SimpleGrid>
          </Box>
          )}

          {/* Validation panel */}
          {validationIssues.length > 0 && resources.length > 0 && (
            <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg" mt="5" data-testid="validation-panel">
              <Card.Body p="4">
                <Text {...pixelFontProps} fontSize="2xs" color="aspire.300" mb="3">
                  ⚡ Validation ({validationIssues.length})
                </Text>
                <Box
                  bg="#0D0B1A" borderRadius="sm" p="3" fontFamily="mono" fontSize="12px"
                  border="1px solid" borderColor="dark.border"
                  maxH="200px" overflowY="auto"
                >
                  {validationIssues.map((issue, i) => {
                    const icon = issue.level === 'error' ? '❌' : issue.level === 'warning' ? '⚠️' : 'ℹ️';
                    const color = issue.level === 'error' ? 'red.400' : issue.level === 'warning' ? 'yellow.400' : 'blue.300';
                    return (
                      <Text
                        key={i} fontSize="xs" color={color} mb="1"
                        cursor={issue.resourceId ? 'pointer' : undefined}
                        role={issue.resourceId ? 'button' : undefined}
                        tabIndex={issue.resourceId ? 0 : undefined}
                        _hover={issue.resourceId ? { textDecoration: 'underline' } : undefined}
                        data-testid={`validation-issue-${i}`}
                        onClick={() => {
                          if (issue.resourceId) {
                            setHighlightedResource(issue.resourceId);
                            setTimeout(() => setHighlightedResource(null), 2000);
                            const el = canvasContainerRef.current?.querySelector(`[data-resource-id="${issue.resourceId}"]`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (issue.resourceId && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            setHighlightedResource(issue.resourceId);
                            setTimeout(() => setHighlightedResource(null), 2000);
                            const el = canvasContainerRef.current?.querySelector(`[data-resource-id="${issue.resourceId}"]`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }}
                      >
                        {icon} {issue.message}
                      </Text>
                    );
                  })}
                </Box>
              </Card.Body>
            </Card.Root>
          )}
        </Tabs.Content>

        {/* ── Code Tab ─────────────────────────────────────────────── */}
        <Tabs.Content value="code">
          <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg">
            <Card.Body p="5">
              <Flex justify="space-between" align="center" mb="4">
                <Tabs.Root value={activeLanguage} onValueChange={(d) => setActiveLanguage(d.value as CodeLanguage)}>
                  <Tabs.List gap="1">
                    {LANGUAGES.map((lang) => (
                      <Tabs.Trigger key={lang.id} value={lang.id}
                        fontSize="10px" px="3" py="1.5" {...pixelFontProps}
                        color="dark.muted"
                        _selected={{ bg: 'aspire.200', color: 'aspire.accent' }}
                        borderRadius="sm" data-testid={`lang-tab-${lang.id}`}
                      >
                        {lang.icon} {lang.label}
                      </Tabs.Trigger>
                    ))}
                  </Tabs.List>
                </Tabs.Root>
                <Flex gap="2">
                  <Button size="xs" variant="outline"
                    colorPalette={copied ? 'green' : 'purple'}
                    onClick={copyCode} data-testid="copy-code-btn"
                  >
                    <TbCopy /> {copied ? 'Copied!' : 'Copy'}
                  </Button>
                  <Button size="xs" variant="outline" colorPalette="purple"
                    onClick={downloadCode} aria-label="Download code file"
                  >
                    <TbDownload /> Download
                  </Button>
                  <Button size="xs" variant={showImport ? 'solid' : 'outline'} colorPalette="purple"
                    onClick={() => setShowImport(!showImport)} aria-label="Import AppHost code"
                  >
                    <TbUpload /> Import
                  </Button>
                </Flex>
              </Flex>

              {/* Import panel */}
              {showImport && (
                <Box mb="4" p="3" bg="dark.surface" borderRadius="sm" border="1px solid" borderColor="dark.border">
                  <Text fontSize="xs" color="dark.muted" mb="2">
                    Paste C# AppHost code to import resources:
                  </Text>
                  <Textarea
                    size="sm" value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="var builder = DistributedApplication.CreateBuilder(args);&#10;var postgres = builder.AddPostgres(&quot;pg&quot;);&#10;..."
                    rows={6}
                    fontFamily="mono" fontSize="12px"
                    bg="#0D0B1A" color="dark.text"
                    aria-label="AppHost code to import"
                  />
                  <Flex gap="2" mt="2">
                    <Button size="xs" colorPalette="purple" onClick={handleImport}
                      disabled={!importText.trim()}
                    >
                      Import Resources
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => { setShowImport(false); setImportText(''); }}>
                      Cancel
                    </Button>
                  </Flex>
                </Box>
              )}

              {/* Name warnings */}
              {nameWarnings.length > 0 && (
                <Box mb="3" p="2" bg="red.950" borderRadius="sm" border="1px solid" borderColor="red.700">
                  {nameWarnings.map((w, i) => (
                    <Text key={i} fontSize="xs" color="red.300">⚠️ {w}</Text>
                  ))}
                </Box>
              )}

              <Box borderRadius="sm" overflow="auto" maxH="600px" role="region" aria-label="Generated AppHost code"
                css={{ '& pre': { margin: 0, borderRadius: '4px', fontSize: '13px !important' } }}
                data-testid="generated-code"
              >
                <SyntaxHighlighter
                  language={activeLanguage === 'typescript' ? 'typescript' : 'csharp'}
                  style={vscDarkPlus}
                  customStyle={{ background: '#0D0B1A', padding: '20px', borderRadius: '4px', fontSize: '13px', lineHeight: '1.6' }}
                  showLineNumbers
                >
                  {generatedCode}
                </SyntaxHighlighter>
              </Box>
            </Card.Body>
          </Card.Root>

          {/* Scaffolds */}
          {scaffolds.length > 0 && (
            <Card.Root variant="outline" {...retroCardProps} bg="game.retroBg" mt="4">
              <Card.Body p="5">
                <Flex justify="space-between" align="center" mb="3">
                  <Text {...pixelFontProps} fontSize="2xs" color="aspire.300">
                    📂 Project Scaffolds
                  </Text>
                  <Button size="xs" variant={showScaffolds ? 'solid' : 'outline'} colorPalette="purple"
                    onClick={() => setShowScaffolds(!showScaffolds)} data-testid="toggle-scaffolds"
                  >
                    <TbFileText /> {showScaffolds ? 'Hide' : 'Show'} Files
                  </Button>
                </Flex>

                {showScaffolds ? (
                  <Flex direction="column" gap="5">
                    {scaffolds.map((scaffold) => (
                      <Box key={scaffold.name}>
                        <Flex align="center" gap="2" mb="3">
                          <Text fontSize="xs" color="dark.text" fontWeight="bold">📦 {scaffold.name}</Text>
                          <Badge fontSize="2xs" colorPalette={scaffold.lang === 'TypeScript' || scaffold.lang === 'Node.js' ? 'blue' : scaffold.lang === 'Python' ? 'green' : 'purple'} variant="subtle">
                            {scaffold.lang}
                          </Badge>
                        </Flex>
                        {scaffold.files.map((file) => (
                          <Box key={file.path} mb="3">
                            <Text fontSize="2xs" color="aspire.accent" mb="1" fontFamily="mono">📄 {file.path}</Text>
                            <Box borderRadius="sm" overflow="auto" maxH="200px"
                              css={{ '& pre': { margin: 0, borderRadius: '4px', fontSize: '11px !important' } }}
                            >
                              <SyntaxHighlighter
                                language={file.language === 'text' ? 'plaintext' : file.language}
                                style={vscDarkPlus}
                                customStyle={{ background: '#0D0B1A', padding: '12px', borderRadius: '4px', fontSize: '11px', lineHeight: '1.5' }}
                                showLineNumbers
                              >
                                {file.content}
                              </SyntaxHighlighter>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Flex>
                ) : (
                  <Text fontSize="xs" color="dark.muted">
                    {scaffolds.length} project{scaffolds.length !== 1 ? 's' : ''} with generated starter code
                  </Text>
                )}
              </Card.Body>
            </Card.Root>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
}
