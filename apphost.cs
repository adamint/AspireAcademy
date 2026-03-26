#:sdk Aspire.AppHost.Sdk@13.2.0
#:package Aspire.Hosting.PostgreSQL@9.*
#:package Aspire.Hosting.Redis@9.*

var builder = DistributedApplication.CreateBuilder(args);

// Infrastructure
var postgres = builder.AddPostgres("postgres")
    .WithDataVolume("aspire-academy-pgdata")
    .AddDatabase("academydb");
var redis = builder.AddRedis("cache");
var openai = builder.AddConnectionString("openai");

// Code execution service (Docker container for sandboxing + polyglot SDK support)
// NOTE: Network isolation (--network=none) is not feasible here because the API
// communicates with CodeRunner over HTTP. User code runs as a subprocess inside
// the container and inherits its network access. Restricting that would require
// nested containers or seccomp profiles. The --read-only + --tmpfs flags provide
// filesystem isolation as a partial mitigation.
var codeRunner = builder.AddDockerfile("coderunner", "./AspireAcademy.CodeRunner")
    .WithHttpEndpoint(targetPort: 8080)
    .WithContainerRuntimeArgs("--memory=512m")
    .WithContainerRuntimeArgs("--pids-limit=50")
    .WithContainerRuntimeArgs("--cpus=1.0")
    .WithContainerRuntimeArgs("--read-only")
    .WithContainerRuntimeArgs("--tmpfs=/tmp:rw,size=100m");

// API backend
var api = builder.AddProject<Projects.AspireAcademy_Api>("api")
    .WithReference(postgres)
    .WithReference(redis)
    .WithReference(openai)
    .WithReference(codeRunner)
    .WaitFor(postgres)
    .WaitFor(redis);

// React frontend
var web = builder.AddNpmApp("web", "./AspireAcademy.Web", "dev")
    .WithReference(api)
    .WithHttpEndpoint(env: "PORT")
    .WithExternalHttpEndpoints()
    .WaitFor(api);

builder.Build().Run();
