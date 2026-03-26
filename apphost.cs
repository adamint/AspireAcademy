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
var codeRunner = builder.AddDockerfile("coderunner", "./AspireAcademy.CodeRunner")
    .WithHttpEndpoint(targetPort: 8080)
    .WithContainerRuntimeArgs("--memory=512m")
    .WithContainerRuntimeArgs("--pids-limit=50");

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
