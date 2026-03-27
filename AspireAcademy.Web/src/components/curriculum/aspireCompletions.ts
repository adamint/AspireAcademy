import type * as monaco from 'monaco-editor';

type Monaco = typeof monaco;

interface AspireMethod {
  label: string;
  insertText: string;
  detail: string;
  documentation: string;
  signature: string;
}

const builderMethods: AspireMethod[] = [
  { label: 'AddPostgres', insertText: 'AddPostgres("${1:name}")', detail: 'Adds a PostgreSQL server resource', documentation: 'Adds a PostgreSQL server resource to the distributed application builder. Returns an IResourceBuilder<PostgresServerResource> that can be used to further customize the resource.', signature: 'IResourceBuilder<PostgresServerResource> AddPostgres(string name)' },
  { label: 'AddRedis', insertText: 'AddRedis("${1:name}")', detail: 'Adds a Redis cache resource', documentation: 'Adds a Redis cache resource to the distributed application builder. Returns an IResourceBuilder<RedisResource> that can be used to further customize the resource.', signature: 'IResourceBuilder<RedisResource> AddRedis(string name)' },
  { label: 'AddSqlServer', insertText: 'AddSqlServer("${1:name}")', detail: 'Adds a SQL Server resource', documentation: 'Adds a SQL Server resource to the distributed application builder. Returns an IResourceBuilder<SqlServerServerResource> that can be used to further customize the resource.', signature: 'IResourceBuilder<SqlServerServerResource> AddSqlServer(string name)' },
  { label: 'AddMongoDB', insertText: 'AddMongoDB("${1:name}")', detail: 'Adds a MongoDB resource', documentation: 'Adds a MongoDB resource to the distributed application builder. Returns an IResourceBuilder<MongoDBServerResource> that can be used to further customize the resource.', signature: 'IResourceBuilder<MongoDBServerResource> AddMongoDB(string name)' },
  { label: 'AddMySql', insertText: 'AddMySql("${1:name}")', detail: 'Adds a MySQL resource', documentation: 'Adds a MySQL resource to the distributed application builder. Returns an IResourceBuilder<MySqlServerResource> that can be used to further customize the resource.', signature: 'IResourceBuilder<MySqlServerResource> AddMySql(string name)' },
  { label: 'AddRabbitMQ', insertText: 'AddRabbitMQ("${1:name}")', detail: 'Adds a RabbitMQ message broker', documentation: 'Adds a RabbitMQ message broker resource to the distributed application builder.', signature: 'IResourceBuilder<RabbitMQServerResource> AddRabbitMQ(string name)' },
  { label: 'AddKafka', insertText: 'AddKafka("${1:name}")', detail: 'Adds a Kafka message broker', documentation: 'Adds a Kafka message broker resource to the distributed application builder.', signature: 'IResourceBuilder<KafkaServerResource> AddKafka(string name)' },
  { label: 'AddNats', insertText: 'AddNats("${1:name}")', detail: 'Adds a NATS messaging server', documentation: 'Adds a NATS messaging server resource to the distributed application builder.', signature: 'IResourceBuilder<NatsServerResource> AddNats(string name)' },
  { label: 'AddProject', insertText: 'AddProject<${1:Projects.MyService}>("${2:name}")', detail: 'Adds a .NET project resource', documentation: 'Adds a .NET project resource to the distributed application builder. The type parameter specifies the project to add.', signature: 'IResourceBuilder<ProjectResource> AddProject<T>(string name)' },
  { label: 'AddCSharpApp', insertText: 'AddCSharpApp("${1:name}", "${2:path}")', detail: 'Adds a C# app by path', documentation: 'Adds a C# application resource from the specified project path.', signature: 'IResourceBuilder<ProjectResource> AddCSharpApp(string name, string path)' },
  { label: 'AddViteApp', insertText: 'AddViteApp("${1:name}", "${2:path}")', detail: 'Adds a Vite/React app', documentation: 'Adds a Vite-based frontend application resource from the specified path.', signature: 'IResourceBuilder<NodeAppResource> AddViteApp(string name, string path)' },
  { label: 'AddPythonApp', insertText: 'AddPythonApp("${1:name}", "${2:path}", "${3:script}")', detail: 'Adds a Python app', documentation: 'Adds a Python application resource from the specified path and entry script.', signature: 'IResourceBuilder<PythonAppResource> AddPythonApp(string name, string path, string script)' },
  { label: 'AddNodeApp', insertText: 'AddNodeApp("${1:name}", "${2:path}", "${3:script}")', detail: 'Adds a Node.js app', documentation: 'Adds a Node.js application resource from the specified path and script.', signature: 'IResourceBuilder<NodeAppResource> AddNodeApp(string name, string path, string script)' },
  { label: 'AddContainer', insertText: 'AddContainer("${1:name}", "${2:image}")', detail: 'Adds a container resource', documentation: 'Adds a container resource using the specified Docker image.', signature: 'IResourceBuilder<ContainerResource> AddContainer(string name, string image)' },
  { label: 'AddDockerfile', insertText: 'AddDockerfile("${1:name}", "${2:path}")', detail: 'Adds a Dockerfile-based resource', documentation: 'Adds a container resource built from the specified Dockerfile path.', signature: 'IResourceBuilder<ContainerResource> AddDockerfile(string name, string path)' },
  { label: 'AddConnectionString', insertText: 'AddConnectionString("${1:name}")', detail: 'Adds an external connection string', documentation: 'Adds an external connection string resource. The value is read from configuration at runtime.', signature: 'IResourceBuilder<IResourceWithConnectionString> AddConnectionString(string name)' },
  { label: 'AddParameter', insertText: 'AddParameter("${1:name}")', detail: 'Adds a parameter resource', documentation: 'Adds a parameter resource whose value is read from configuration.', signature: 'ParameterResource AddParameter(string name)' },
  { label: 'Build', insertText: 'Build()', detail: 'Builds the distributed application', documentation: 'Builds the distributed application and returns a DistributedApplication instance that can be run.', signature: 'DistributedApplication Build()' },
];

const resourceBuilderMethods: AspireMethod[] = [
  { label: 'WithReference', insertText: 'WithReference(${1:resource})', detail: 'Adds a dependency reference', documentation: 'Adds a reference to another resource, injecting the connection information as environment variables.', signature: 'IResourceBuilder<T> WithReference(IResourceBuilder resource)' },
  { label: 'WaitFor', insertText: 'WaitFor(${1:resource})', detail: 'Waits for resource to be healthy before starting', documentation: 'Configures this resource to wait for the specified resource to report healthy before starting.', signature: 'IResourceBuilder<T> WaitFor(IResourceBuilder resource)' },
  { label: 'WaitForCompletion', insertText: 'WaitForCompletion(${1:resource})', detail: 'Waits for resource to finish', documentation: 'Configures this resource to wait for the specified resource to run to completion before starting.', signature: 'IResourceBuilder<T> WaitForCompletion(IResourceBuilder resource)' },
  { label: 'WithEnvironment', insertText: 'WithEnvironment("${1:name}", "${2:value}")', detail: 'Sets an environment variable', documentation: 'Sets an environment variable on the resource.', signature: 'IResourceBuilder<T> WithEnvironment(string name, string value)' },
  { label: 'WithHttpEndpoint', insertText: 'WithHttpEndpoint(${1:port}, targetPort: ${2:targetPort}, name: "${3:name}")', detail: 'Adds an HTTP endpoint', documentation: 'Adds an HTTP endpoint to the resource with the specified port configuration.', signature: 'IResourceBuilder<T> WithHttpEndpoint(int? port, int targetPort, string name)' },
  { label: 'WithHttpsEndpoint', insertText: 'WithHttpsEndpoint(${1:port}, targetPort: ${2:targetPort}, name: "${3:name}")', detail: 'Adds an HTTPS endpoint', documentation: 'Adds an HTTPS endpoint to the resource with the specified port configuration.', signature: 'IResourceBuilder<T> WithHttpsEndpoint(int? port, int targetPort, string name)' },
  { label: 'WithEndpoint', insertText: 'WithEndpoint("${1:name}", ${2:callback})', detail: 'Adds a custom endpoint', documentation: 'Adds a custom endpoint to the resource using a callback for configuration.', signature: 'IResourceBuilder<T> WithEndpoint(string name, Action<EndpointAnnotation> callback)' },
  { label: 'WithVolume', insertText: 'WithVolume("${1:name}", "${2:target}")', detail: 'Mounts a named volume', documentation: 'Mounts a named Docker volume into the container at the specified target path.', signature: 'IResourceBuilder<T> WithVolume(string name, string target)' },
  { label: 'WithBindMount', insertText: 'WithBindMount("${1:source}", "${2:target}")', detail: 'Mounts a host directory', documentation: 'Mounts a host directory into the container at the specified target path.', signature: 'IResourceBuilder<T> WithBindMount(string source, string target)' },
  { label: 'WithArgs', insertText: 'WithArgs(${1:args})', detail: 'Passes command-line arguments', documentation: 'Passes the specified command-line arguments to the resource process.', signature: 'IResourceBuilder<T> WithArgs(params string[] args)' },
  { label: 'WithExternalHttpEndpoints', insertText: 'WithExternalHttpEndpoints()', detail: 'Makes endpoints externally accessible', documentation: 'Marks all HTTP endpoints on this resource as externally accessible.', signature: 'IResourceBuilder<T> WithExternalHttpEndpoints()' },
  { label: 'WithDataVolume', insertText: 'WithDataVolume("${1:name}")', detail: 'Adds a data persistence volume', documentation: 'Adds a persistent data volume to the resource for data storage.', signature: 'IResourceBuilder<T> WithDataVolume(string? name)' },
  { label: 'WithLifetime', insertText: 'WithLifetime(ContainerLifetime.${1|Session,Persistent|})', detail: 'Sets container lifetime (Session/Persistent)', documentation: 'Sets the container lifetime. Session means the container stops with the app; Persistent means it survives restarts.', signature: 'IResourceBuilder<T> WithLifetime(ContainerLifetime lifetime)' },
  { label: 'WithReplicas', insertText: 'WithReplicas(${1:count})', detail: 'Sets replica count', documentation: 'Configures the number of replicas to run for this resource.', signature: 'IResourceBuilder<T> WithReplicas(int count)' },
  { label: 'AddDatabase', insertText: 'AddDatabase("${1:name}")', detail: 'Adds a database to a server resource', documentation: 'Adds a database to a database server resource and returns a reference to the database.', signature: 'IResourceBuilder<DatabaseResource> AddDatabase(string name)' },
  { label: 'WithPgAdmin', insertText: 'WithPgAdmin()', detail: 'Adds PgAdmin management UI', documentation: 'Adds a PgAdmin container for managing the PostgreSQL server.', signature: 'IResourceBuilder<PostgresServerResource> WithPgAdmin()' },
  { label: 'WithRedisCommander', insertText: 'WithRedisCommander()', detail: 'Adds Redis Commander UI', documentation: 'Adds a Redis Commander container for managing the Redis instance.', signature: 'IResourceBuilder<RedisResource> WithRedisCommander()' },
  { label: 'WithManagementPlugin', insertText: 'WithManagementPlugin()', detail: 'Adds RabbitMQ management UI', documentation: 'Enables the RabbitMQ management plugin for the broker.', signature: 'IResourceBuilder<RabbitMQServerResource> WithManagementPlugin()' },
  { label: 'WithKafkaUI', insertText: 'WithKafkaUI()', detail: 'Adds Kafka UI', documentation: 'Adds a Kafka UI container for managing the Kafka broker.', signature: 'IResourceBuilder<KafkaServerResource> WithKafkaUI()' },
];

const snippetPatterns: AspireMethod[] = [
  { label: 'DistributedApplication.CreateBuilder', insertText: 'var builder = DistributedApplication.CreateBuilder(args);', detail: 'Aspire app builder', documentation: 'Creates a new DistributedApplicationBuilder, the entry point for configuring an Aspire application.', signature: 'DistributedApplicationBuilder DistributedApplication.CreateBuilder(string[] args)' },
  { label: 'builder.Build().Run()', insertText: 'builder.Build().Run();', detail: 'Build and run the app', documentation: 'Builds the distributed application and runs it. This is typically the last line in an Aspire AppHost Program.cs.', signature: 'void Run()' },
];

const allMethods = [...builderMethods, ...resourceBuilderMethods, ...snippetPatterns];

function toCompletionItem(
  m: AspireMethod,
  range: monaco.IRange,
  monacoInstance: Monaco,
  kind: monaco.languages.CompletionItemKind,
): monaco.languages.CompletionItem {
  return {
    label: m.label,
    kind,
    detail: m.detail,
    documentation: { value: `**${m.signature}**\n\n${m.documentation}` },
    insertText: m.insertText,
    insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    range,
  };
}

function getRange(position: monaco.Position, word: monaco.editor.IWordAtPosition): monaco.IRange {
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
}

let registered = false;

export function registerAspireCompletions(monacoInstance: Monaco): void {
  if (registered) {
    return;
  }
  registered = true;

  // Completion provider
  monacoInstance.languages.registerCompletionItemProvider('csharp', {
    triggerCharacters: ['.'],
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = getRange(position, word);
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      if (textBeforeCursor.endsWith('builder.')) {
        return {
          suggestions: builderMethods.map((m) =>
            toCompletionItem(m, range, monacoInstance, monacoInstance.languages.CompletionItemKind.Method),
          ),
        };
      }

      // Chained resource builder calls — after "." preceded by ")" or identifier
      if (/(\)|\w)\.\s*$/.test(textBeforeCursor) && !textBeforeCursor.endsWith('builder.')) {
        return {
          suggestions: resourceBuilderMethods.map((m) =>
            toCompletionItem(m, range, monacoInstance, monacoInstance.languages.CompletionItemKind.Method),
          ),
        };
      }

      // General context — offer snippets
      return {
        suggestions: snippetPatterns.map((m) =>
          toCompletionItem(m, range, monacoInstance, monacoInstance.languages.CompletionItemKind.Snippet),
        ),
      };
    },
  });

  // Hover provider
  monacoInstance.languages.registerHoverProvider('csharp', {
    provideHover: (model, position) => {
      const word = model.getWordAtPosition(position);
      if (!word) {
        return null;
      }

      const match = allMethods.find((m) => m.label === word.word);
      if (!match) {
        return null;
      }

      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        },
        contents: [
          { value: `\`\`\`csharp\n${match.signature}\n\`\`\`` },
          { value: match.documentation },
        ],
      };
    },
  });

  // Validation markers for unknown method names
  const knownMethodNames = new Set(allMethods.map((m) => m.label));
  const methodCallPattern = /\.(\w+)\s*\(/g;

  try {
    monacoInstance.editor.onDidCreateModel((model) => {
      validateModel(model, monacoInstance, knownMethodNames, methodCallPattern);
      model.onDidChangeContent(() => {
        validateModel(model, monacoInstance, knownMethodNames, methodCallPattern);
      });
    });

    for (const model of monacoInstance.editor.getModels()) {
      validateModel(model, monacoInstance, knownMethodNames, methodCallPattern);
    }
  } catch {
    // Monaco API may not support all methods in all versions — fail silently
    console.warn('[aspireCompletions] Validation markers not available');
  }
}

// Well-known C# / .NET methods that should not be flagged
const frameworkMethods = new Set([
  'CreateBuilder', 'Run', 'Build', 'ToString', 'Equals', 'GetHashCode', 'GetType',
  'AddSingleton', 'AddScoped', 'AddTransient', 'AddHostedService',
  'MapGet', 'MapPost', 'MapPut', 'MapDelete', 'MapControllers',
  'UseRouting', 'UseEndpoints', 'UseHttpsRedirection', 'UseAuthorization',
  'ConfigureServices', 'Configure', 'AddControllers', 'AddEndpointsApiExplorer',
  'AddSwaggerGen', 'UseSwagger', 'UseSwaggerUI',
  'Substring', 'Contains', 'StartsWith', 'EndsWith', 'Replace', 'Split',
  'Add', 'Remove', 'Clear', 'Count', 'ToList', 'ToArray', 'Select', 'Where',
  'FirstOrDefault', 'First', 'Last', 'Any', 'All',
  'WriteLine', 'ReadLine', 'Write', 'Log', 'LogInformation', 'LogWarning', 'LogError',
]);

function validateModel(
  model: monaco.editor.ITextModel,
  monacoInstance: Monaco,
  knownMethodNames: Set<string>,
  methodCallPattern: RegExp,
): void {
  if (model.getLanguageId() !== 'csharp') {
    return;
  }

  const markers: monaco.editor.IMarkerData[] = [];
  const lineCount = model.getLineCount();

  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
    const lineContent = model.getLineContent(lineNumber);
    methodCallPattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = methodCallPattern.exec(lineContent)) !== null) {
      const methodName = match[1];
      if (!knownMethodNames.has(methodName) && !frameworkMethods.has(methodName)) {
        markers.push({
          severity: monacoInstance.MarkerSeverity.Warning,
          message: `Unknown Aspire method: '${methodName}'. Check the API reference for valid methods.`,
          startLineNumber: lineNumber,
          endLineNumber: lineNumber,
          startColumn: match.index + 2, // skip the leading "."
          endColumn: match.index + 2 + methodName.length,
        });
      }
    }
  }

  monacoInstance.editor.setModelMarkers(model, 'aspire-validation', markers);
}
