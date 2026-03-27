#:sdk Aspire.AppHost.Sdk@13.2.0
#:package Aspire.Hosting.Azure.PostgreSQL@13.*
#:package Aspire.Hosting.Azure.Redis@13.*
#:package Aspire.Hosting.Azure.AppContainers@13.*
#:package Aspire.Hosting.JavaScript@13.*
#:package StackExchange.Redis@2.*
#:property NoWarn=ASPIRECSHARPAPPS001

#pragma warning disable ASPIREPUBLISHERS001  // Azure publishers are in preview

using Aspire.Hosting.ApplicationModel;
using StackExchange.Redis;

var builder = DistributedApplication.CreateBuilder(args);

// Azure Container Apps compute environment (used by aspire publish/deploy)
builder.AddAzureContainerAppEnvironment("aca-env");

// Infrastructure — Azure-native in publish mode, local containers in run mode
var postgresServer = builder.AddAzurePostgresFlexibleServer("postgres")
    .RunAsContainer(c => c.WithDataVolume("aspire-learn-pgdata").WithPgAdmin());
var postgres = postgresServer.AddDatabase("academydb");
var redis = builder.AddAzureManagedRedis("cache")
    .RunAsContainer(c => c.WithRedisCommander());
var openai = builder.AddConnectionString("openai");

// API backend
var api = builder.AddCSharpApp("api", "./AspireAcademy.Api/")
    .WithReference(postgres)
    .WithReference(redis)
    .WithReference(openai)
    .WaitFor(postgres)
    .WaitFor(redis)
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

if (builder.ExecutionContext.IsRunMode)
{
    // Dev: derive a stable key from the machine name so tokens survive restarts
    var devJwtKey = Convert.ToBase64String(
        System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes($"AspireAcademy-dev-jwt-{Environment.MachineName}")));
    api = api.WithEnvironment("Jwt__Key", devJwtKey);
}
else
{
    // Publish/deploy: register parameter (prompted once, stored as ACA secret)
    var jwtKey = builder.AddParameter("jwt-key", secret: true);
    api = api.WithEnvironment("Jwt__Key", jwtKey);
}

// ── Custom Aspire Dashboard commands ──

// Generate a random secret for internal admin commands (not guessable from outside)
var adminSecret = Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));

// Pass the secret to the API as configuration so IsAdmin can verify it
api = api.WithEnvironment("Admin__InternalSecret", adminSecret);

// Helper to add internal admin auth header to requests
Task AddAdminHeader(HttpCommandRequestContext ctx)
{
    ctx.Request.Headers.Add("X-Aspire-Admin", adminSecret);
    return Task.CompletedTask;
}

// API resource commands
api.WithHttpCommand("/api/admin/reload-curriculum-internal", "Reload Curriculum", commandOptions: new HttpCommandOptions
{
    Description = "Re-reads curriculum YAML/Markdown files from disk without restarting",
    ConfirmationMessage = "Reload all curriculum content from disk?",
    IconName = "ArrowSync",
    PrepareRequest = AddAdminHeader
});

api.WithHttpCommand("/api/admin/seed-test-data-internal", "Seed Test Data", commandOptions: new HttpCommandOptions
{
    Description = "Creates a test user with sample progress for development",
    IconName = "PersonAdd",
    PrepareRequest = AddAdminHeader
});

api.WithHttpCommand("/api/admin/flush-db-internal", "Flush Database", commandOptions: new HttpCommandOptions
{
    Description = "Drops and recreates all tables, then reloads curriculum (dev only)",
    ConfirmationMessage = "⚠️ This will DELETE all data and recreate the schema. Continue?",
    IconName = "DatabaseWarning",
    PrepareRequest = AddAdminHeader
});

// PostgreSQL resource command — resets data via the API's flush-db endpoint
postgresServer.WithHttpCommand("/api/admin/flush-db-internal", "Reset Data",
    endpointSelector: () => api.GetEndpoint("http"),
    commandOptions: new HttpCommandOptions
    {
        Description = "Drops all tables and reloads curriculum data",
        ConfirmationMessage = "⚠️ This will DELETE all database data and recreate the schema. Continue?",
        IconName = "DatabaseLightning",
        PrepareRequest = AddAdminHeader
    });

// Redis resource command — sends FLUSHALL directly to Redis (dev-time only)
if (builder.ExecutionContext.IsRunMode)
{
    redis.WithCommand("flush-all", "Flush All", async context =>
    {
        try
        {
            // In run-as-container mode, the resource wraps a local Redis container.
            // Access its endpoint via IResourceWithEndpoints on the resource itself.
            if (redis.Resource is not IResourceWithEndpoints withEndpoints)
            {
                return CommandResults.Failure("Redis resource does not expose endpoints.");
            }

            var endpoint = withEndpoints.GetEndpoint("tcp");
            if (!endpoint.IsAllocated)
            {
                return CommandResults.Failure("Redis endpoint is not yet allocated.");
            }

            await using var connection = await ConnectionMultiplexer.ConnectAsync(
                $"{endpoint.Host}:{endpoint.Port}");

            var server = connection.GetServers()[0];
            await server.FlushAllDatabasesAsync();

            return CommandResults.Success();
        }
        catch (Exception ex)
        {
            return CommandResults.Failure($"Failed to flush Redis: {ex.Message}");
        }
    }, commandOptions: new CommandOptions
    {
        Description = "Clears all Redis keys (leaderboards, rate limits, cache)",
        ConfirmationMessage = "Flush all Redis data? This clears leaderboards, rate limits, and cache.",
        IconName = "Delete"
    });
}

// React frontend (Vite)
// Dev: runs as separate Vite dev server with proxy to API
// Publish: build output bundled into API container as static files
var web = builder.AddViteApp("web", "./AspireAcademy.Web")
    .WithNpm()
    .WithReference(api)
    .WaitFor(api);

// In publish mode, bundle the React build into the API container's wwwroot folder
api.PublishWithContainerFiles(web, "./wwwroot");

builder.Build().Run();
