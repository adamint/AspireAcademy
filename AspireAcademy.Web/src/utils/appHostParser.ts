// Types shared between PlaygroundPage and the parser
export type CodeLanguage = 'csharp' | 'typescript';

export type ResourceType =
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

export interface PlaygroundResource {
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
  envVars: { key: string; value: string }[];
  isPersistent: boolean;
  isSecret: boolean;
  args: string;
  scriptPath: string;
  projectPath: string;
  projectLanguage: CodeLanguage;
}

let idCounter = 0;
export function makeId(): string {
  return `r-${++idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeResource(overrides: Partial<PlaygroundResource> & { id: string; type: ResourceType; name: string }): PlaygroundResource {
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

export const METHOD_TO_TYPE: Record<string, ResourceType> = {
  AddPostgres: 'postgres', AddRedis: 'redis', AddSqlServer: 'sqlserver',
  AddMongoDB: 'mongodb', AddRabbitMQ: 'rabbitmq', AddKafka: 'kafka',
  AddProject: 'project', AddCSharpApp: 'project',
  AddContainer: 'container',
  AddNpmApp: 'npmapp', AddViteApp: 'npmapp', AddJavaScriptApp: 'npmapp', AddNodeApp: 'npmapp',
  AddPythonApp: 'pythonapp', AddUvicornApp: 'pythonapp', AddUvApp: 'pythonapp',
  AddAzureStorage: 'azurestorage', AddAzureKeyVault: 'keyvault',
  AddParameter: 'parameter', AddConnectionString: 'parameter',
  AddYarp: 'container', AddElasticsearch: 'container',
  AddMySql: 'container', AddOracle: 'container', AddNats: 'container',
};

export function preprocessCode(code: string): string {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/#(?:if|else|endif|pragma|region|endregion).*$/gm, '')
    .replace(/\r\n/g, '\n');
}

export function splitStatements(code: string): string[] {
  // Collapse to single line first
  const flat = code.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  // Split on semicolons that are NOT inside braces (lambda bodies)
  const statements: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of flat) {
    if (ch === '{') { depth++; current += ch; }
    else if (ch === '}') { depth--; current += ch; }
    else if (ch === ';' && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = '';
    }
    else { current += ch; }
  }
  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

export function parseAppHostCode(code: string): PlaygroundResource[] {
  const resources: PlaygroundResource[] = [];
  const varToId = new Map<string, string>();
  const varToStmt = new Map<string, string>();

  const cleaned = preprocessCode(code);
  const statements = splitStatements(cleaned);

  for (const stmt of statements) {
    const addMatch = stmt.match(
      /(?:var|const|[A-Z]\w*)\s+(\w+)\s*=\s*builder\.(\w+)\s*(?:<[^>]+>)?\s*\(\s*"([^"]+)"(?:\s*,\s*(?:@?"([^"]*)"))?/
    );
    if (addMatch) {
      const [, varName, method, name, secondArg] = addMatch;
      const type = METHOD_TO_TYPE[method];
      if (type) {
        const id = makeId();
        varToId.set(varName, id);
        varToStmt.set(varName, stmt);

        const r = makeResource({ id, type, name });
        if (type === 'container' && secondArg) r.image = secondArg;
        if ((type === 'npmapp' || type === 'pythonapp' || type === 'project') && secondArg) r.projectPath = secondArg;
        if (type === 'parameter' && /secret\s*:\s*true/i.test(stmt)) r.isSecret = true;
        resources.push(r);
      }
    }

    // .AddDatabase()
    const dbMatches = stmt.matchAll(/\.AddDatabase\s*\(\s*"([^"]+)"\s*\)/g);
    for (const dbMatch of dbMatches) {
      const dbName = dbMatch[1];
      const parentAddMatch = stmt.match(/(?:var|const|[A-Z]\w*)\s+(\w+)\s*=\s*builder\.(\w+)/);
      if (parentAddMatch) {
        const parentId = varToId.get(parentAddMatch[1]);
        if (parentId) {
          const parent = resources.find(r => r.id === parentId);
          if (parent && !parent.databases.includes(dbName)) parent.databases.push(dbName);
        }
      } else {
        const standaloneMatch = stmt.match(/(\w+)\s*\.\s*AddDatabase/);
        if (standaloneMatch) {
          const parentId = varToId.get(standaloneMatch[1]);
          if (parentId) {
            const parent = resources.find(r => r.id === parentId);
            if (parent && !parent.databases.includes(dbName)) parent.databases.push(dbName);
          }
        }
      }
    }

    // .WithReference() / .WaitFor()
    const refMatches = stmt.matchAll(/\.(WithReference|WaitFor)\s*\(\s*(\w+)\s*\)/g);
    for (const refMatch of refMatches) {
      const [, method, depVar] = refMatch;
      const depId = varToId.get(depVar);
      if (!depId) continue;

      // Find consumer: the variable being assigned in this statement, or the first var in the chain
      let consumerId: string | undefined;
      const assignMatch = stmt.match(/(?:var|const|[A-Z]\w*)\s+(\w+)\s*=/);
      if (assignMatch) {
        consumerId = varToId.get(assignMatch[1]);
      }
      if (!consumerId) {
        const chainMatch = stmt.match(/^(\w+)\s*\./);
        if (chainMatch) consumerId = varToId.get(chainMatch[1]);
      }
      if (!consumerId) continue;

      const consumer = resources.find(r => r.id === consumerId);
      if (!consumer) continue;
      if (method === 'WithReference' && !consumer.references.includes(depId)) consumer.references.push(depId);
      if (method === 'WaitFor' && !consumer.waitFor.includes(depId)) consumer.waitFor.push(depId);
    }
  }

  // Attribute scan
  for (const r of resources) {
    const varName = [...varToId.entries()].find(([, id]) => id === r.id)?.[0];
    if (!varName) continue;
    const stmt = varToStmt.get(varName) ?? '';
    // Also check follow-up statements that reference this var
    const allStmts = statements.filter(s => s.includes(varName));
    const combined = [stmt, ...allStmts].join(' ');

    if (/\.WithDataVolume/.test(combined)) r.hasDataVolume = true;
    if (/\.WithLifetime\s*\(\s*ContainerLifetime\s*\.\s*Persistent\s*\)/.test(combined)) r.isPersistent = true;
    if (/\.WithExternalHttpEndpoints/.test(combined)) r.hasExternalEndpoints = true;
    if (/\.WithHttpEndpoint/.test(combined)) r.hasExternalEndpoints = true;
  }

  return resources;
}
