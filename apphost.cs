#:sdk Aspire.AppHost.Sdk@13.2.0
#:package Aspire.Hosting.PostgreSQL@9.*
#:package Aspire.Hosting.Redis@9.*
#:package Aspire.Hosting.JavaScript@9.*
#:package StackExchange.Redis@2.*
#:property NoWarn=ASPIRECSHARPAPPS001

using Aspire.Hosting.ApplicationModel;
using StackExchange.Redis;

var builder = DistributedApplication.CreateBuilder(args);

// Infrastructure
var postgresServer = builder.AddPostgres("postgres")
    .WithDataVolume("aspire-academy-pgdata")
    .WithPgAdmin();
var postgres = postgresServer.AddDatabase("academydb");
var redis = builder.AddRedis("cache")
    .WithRedisCommander();
var openai = builder.AddConnectionString("openai");

// API backend
var api = builder.AddCSharpApp("api", "./AspireAcademy.Api/")
    .WithReference(postgres)
    .WithReference(redis)
    .WithReference(openai)
    .WaitFor(postgres)
    .WaitFor(redis);

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

// Redis resource command — sends FLUSHALL directly to Redis
redis.WithCommand("flush-all", "Flush All", async context =>
{
    var endpoint = redis.Resource.PrimaryEndpoint;
    if (!endpoint.IsAllocated)
    {
        return CommandResults.Failure("Redis endpoint is not yet allocated.");
    }

    try
    {
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

// React frontend (Vite)
var web = builder.AddViteApp("web", "./AspireAcademy.Web")
    .WithNpm()
    .WithReference(api)
    .WithExternalHttpEndpoints()
    .WaitFor(api);

builder.Build().Run();
