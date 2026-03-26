#:sdk Aspire.AppHost.Sdk@13.2.0
#:package Aspire.Hosting.PostgreSQL@9.*
#:package Aspire.Hosting.Redis@9.*
#:package Aspire.Hosting.JavaScript@9.*
#:property NoWarn=ASPIRECSHARPAPPS001

var builder = DistributedApplication.CreateBuilder(args);

// Infrastructure
var postgres = builder.AddPostgres("postgres")
    .WithDataVolume("aspire-academy-pgdata")
    .AddDatabase("academydb");
var redis = builder.AddRedis("cache");
var openai = builder.AddConnectionString("openai");

// Code execution service (Docker container for sandboxing + polyglot SDK support)
// NOTE: Network isolation (--network=none) is not feasible because the API
// communicates with CodeRunner over HTTP. User code runs as a subprocess inside
// the container and inherits network access. --read-only + --tmpfs provide
// filesystem isolation as partial mitigation.
var codeRunner = builder.AddDockerfile("coderunner", "./AspireAcademy.CodeRunner")
    .WithHttpEndpoint(targetPort: 8080)
    .WithContainerRuntimeArgs("--memory=512m")
    .WithContainerRuntimeArgs("--pids-limit=50")
    .WithContainerRuntimeArgs("--cpus=1.0")
    .WithContainerRuntimeArgs("--read-only")
    .WithContainerRuntimeArgs("--tmpfs=/tmp:rw,size=100m");

// API backend
var api = builder.AddCSharpApp("api", "./AspireAcademy.Api/")
    .WithReference(postgres)
    .WithReference(redis)
    .WithReference(openai)
    .WithReference(codeRunner.GetEndpoint("http"))
    .WaitFor(postgres)
    .WaitFor(redis);

// React frontend (Vite)
var web = builder.AddViteApp("web", "./AspireAcademy.Web")
    .WithNpm()
    .WithReference(api)
    .WithExternalHttpEndpoints()
    .WaitFor(api);

builder.Build().Run();
