extern alias apphost;

using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace AspireAcademy.Api.Tests;

/// <summary>
/// Shared test fixture that spins up the full Aspire AppHost (Postgres, Redis, API)
/// using DistributedApplicationTestingBuilder. Requires Docker to be running.
/// </summary>
public sealed class AspireIntegrationFixture : IAsyncLifetime
{
    private DistributedApplication? _aspireApp;

    public HttpClient ApiClient { get; private set; } = null!;
    public string PostgresConnectionString { get; private set; } = null!;
    public string RedisConnectionString { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        // Create the test builder from our TestAppHost entry point.
        // This intercepts the AppHost's Program.Main and captures the configured builder.
        var builder = await DistributedApplicationTestingBuilder
            .CreateAsync<apphost::Projects.AspireAcademy_TestAppHost>();

        _aspireApp = await builder.BuildAsync();

        // Start all resources (Postgres container, Redis container, API project)
        // CI runners may need extra time to pull container images
        using var startCts = new CancellationTokenSource(TimeSpan.FromMinutes(5));
        await _aspireApp.StartAsync(startCts.Token);

        // Wait for infrastructure containers to be healthy
        var rns = _aspireApp.Services.GetRequiredService<ResourceNotificationService>();
        await rns.WaitForResourceHealthyAsync("postgres", startCts.Token);
        await rns.WaitForResourceHealthyAsync("cache", startCts.Token);

        // Wait for the API project to be running
        await rns.WaitForResourceAsync("api", KnownResourceStates.Running, startCts.Token);

        // Get real connection strings from running containers
        PostgresConnectionString = await _aspireApp.GetConnectionStringAsync("academydb")
            ?? throw new InvalidOperationException("Failed to get Postgres connection string");
        RedisConnectionString = await _aspireApp.GetConnectionStringAsync("cache")
            ?? throw new InvalidOperationException("Failed to get Redis connection string");

        // Create an HTTP client that talks to the real API resource
        ApiClient = _aspireApp.CreateHttpClient("api");
        ApiClient.Timeout = TimeSpan.FromSeconds(120);
        ApiClient.DefaultRequestHeaders.Add("X-Test-Client", "true");

        // Give the API time to initialize DB and load curriculum on first request
        await WaitForApiHealthy(startCts.Token);
    }

    private async Task WaitForApiHealthy(CancellationToken ct)
    {
        for (var i = 0; i < 120; i++)
        {
            try
            {
                var response = await ApiClient.GetAsync("/health", ct);
                if (response.IsSuccessStatusCode)
                {
                    return;
                }
            }
            catch (HttpRequestException)
            {
                // API not ready yet
            }

            await Task.Delay(1000, ct);
        }

        throw new TimeoutException("API /health did not respond within 120 seconds");
    }

    public async Task DisposeAsync()
    {
        ApiClient?.Dispose();
        if (_aspireApp is not null)
        {
            await _aspireApp.StopAsync();
            await _aspireApp.DisposeAsync();
        }
    }
}

/// <summary>
/// Integration tests that spin up the full Aspire infrastructure (Postgres, Redis)
/// and test the API end-to-end against real services. These catch DB schema issues,
/// connection string problems, service discovery failures, and startup crashes.
/// </summary>
[Trait("Category", "Integration")]
public class AppHostIntegrationTests : IClassFixture<AspireIntegrationFixture>
{
    private readonly AspireIntegrationFixture _fixture;
    private readonly HttpClient _client;

    public AppHostIntegrationTests(AspireIntegrationFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.ApiClient;
    }

    // ================================================================
    // Startup Tests
    // ================================================================

    [Fact]
    public async Task HealthEndpoint_Returns200()
    {
        var response = await _client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AliveEndpoint_Returns200()
    {
        var response = await _client.GetAsync("/alive");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Database_IsAccessible()
    {
        Assert.NotNull(_fixture.PostgresConnectionString);
        Assert.NotEmpty(_fixture.PostgresConnectionString);

        await using var conn = new NpgsqlConnection(_fixture.PostgresConnectionString);
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT 1";
        var result = await cmd.ExecuteScalarAsync();
        Assert.Equal(1, result);
    }

    [Fact]
    public async Task Redis_ConnectionStringIsValid()
    {
        Assert.NotNull(_fixture.RedisConnectionString);
        Assert.NotEmpty(_fixture.RedisConnectionString);
    }

    // ================================================================
    // Database Integrity Tests
    // ================================================================

    [Fact]
    public async Task AllExpectedTablesExist()
    {
        string[] expectedTables =
        [
            "users", "user_xp", "worlds", "modules", "lessons",
            "quiz_questions", "code_challenges", "user_progress",
            "code_submissions", "achievements", "user_achievements",
            "friendships", "xp_events"
        ];

        await using var conn = new NpgsqlConnection(_fixture.PostgresConnectionString);
        await conn.OpenAsync();

        foreach (var table in expectedTables)
        {
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = @table)";
            cmd.Parameters.AddWithValue("table", table);
            var exists = (bool)(await cmd.ExecuteScalarAsync())!;
            Assert.True(exists, $"Table '{table}' should exist in the database");
        }
    }

    [Fact]
    public async Task CurriculumData_IsLoaded()
    {
        await using var conn = new NpgsqlConnection(_fixture.PostgresConnectionString);
        await conn.OpenAsync();

        await using var worldCmd = conn.CreateCommand();
        worldCmd.CommandText = "SELECT COUNT(*) FROM worlds";
        var worldCount = (long)(await worldCmd.ExecuteScalarAsync())!;
        Assert.True(worldCount > 0, "Worlds table should have curriculum data");

        await using var moduleCmd = conn.CreateCommand();
        moduleCmd.CommandText = "SELECT COUNT(*) FROM modules";
        var moduleCount = (long)(await moduleCmd.ExecuteScalarAsync())!;
        Assert.True(moduleCount > 0, "Modules table should have curriculum data");

        await using var lessonCmd = conn.CreateCommand();
        lessonCmd.CommandText = "SELECT COUNT(*) FROM lessons";
        var lessonCount = (long)(await lessonCmd.ExecuteScalarAsync())!;
        Assert.True(lessonCount > 0, "Lessons table should have curriculum data");
    }

    [Fact]
    public async Task ForeignKeys_CascadeDeleteWorks()
    {
        var uniqueId = Guid.NewGuid().ToString("N")[..8];
        var registerResponse = await RegisterUser($"fk_{uniqueId}");
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);

        var authBody = await registerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var userId = authBody.GetProperty("user").GetProperty("id").GetString()!;

        await using var conn = new NpgsqlConnection(_fixture.PostgresConnectionString);
        await conn.OpenAsync();

        // Verify user and user_xp exist
        await using var userCheck = conn.CreateCommand();
        userCheck.CommandText = "SELECT COUNT(*) FROM users WHERE \"Id\" = @id::uuid";
        userCheck.Parameters.AddWithValue("id", userId);
        Assert.Equal(1L, (long)(await userCheck.ExecuteScalarAsync())!);

        await using var xpCheck = conn.CreateCommand();
        xpCheck.CommandText = "SELECT COUNT(*) FROM user_xp WHERE \"UserId\" = @id::uuid";
        xpCheck.Parameters.AddWithValue("id", userId);
        Assert.Equal(1L, (long)(await xpCheck.ExecuteScalarAsync())!);

        // Delete user — should cascade to user_xp
        await using var deleteCmd = conn.CreateCommand();
        deleteCmd.CommandText = "DELETE FROM users WHERE \"Id\" = @id::uuid";
        deleteCmd.Parameters.AddWithValue("id", userId);
        await deleteCmd.ExecuteNonQueryAsync();

        await using var xpAfter = conn.CreateCommand();
        xpAfter.CommandText = "SELECT COUNT(*) FROM user_xp WHERE \"UserId\" = @id::uuid";
        xpAfter.Parameters.AddWithValue("id", userId);
        Assert.Equal(0L, (long)(await xpAfter.ExecuteScalarAsync())!);
    }

    // ================================================================
    // API Functional Tests — Auth
    // ================================================================

    [Fact]
    public async Task Register_ReturnsCreatedWithJwt()
    {
        var uniqueId = Guid.NewGuid().ToString("N")[..8];
        var response = await RegisterUser($"reg_{uniqueId}");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var token = body.GetProperty("token").GetString();
        Assert.False(string.IsNullOrEmpty(token));
        Assert.Contains(".", token);

        var user = body.GetProperty("user");
        Assert.Equal($"reg_{uniqueId}", user.GetProperty("username").GetString());
        Assert.NotEqual(Guid.Empty, Guid.Parse(user.GetProperty("id").GetString()!));
    }

    [Fact]
    public async Task Login_ReturnsJwt()
    {
        var uniqueId = Guid.NewGuid().ToString("N")[..8];
        var username = $"login_{uniqueId}";
        await RegisterUser(username);

        var loginPayload = new { usernameOrEmail = username, password = "TestPass123" };
        var loginResponse = await _client.PostAsJsonAsync("/api/auth/login", loginPayload);
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        var body = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("token").GetString()));
    }

    [Fact]
    public async Task RegisterDuplicate_Returns409()
    {
        var uniqueId = Guid.NewGuid().ToString("N")[..8];
        var username = $"dup_{uniqueId}";

        var first = await RegisterUser(username);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await RegisterUser(username);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }

    [Fact]
    public async Task LoginInvalidCredentials_Returns401()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login",
            new { usernameOrEmail = "nonexistent_user_xyz", password = "WrongPass123" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ================================================================
    // API Functional Tests — Curriculum
    // ================================================================

    [Fact]
    public async Task GetWorlds_ReturnsNonEmptyArray()
    {
        var jwt = await GetAuthToken();

        var response = await SendAuthenticated(HttpMethod.Get, "/api/worlds", jwt);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var worlds = await response.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(worlds);
        Assert.NotEmpty(worlds);

        var first = worlds[0];
        Assert.True(first.TryGetProperty("id", out _));
        Assert.True(first.TryGetProperty("name", out _));
        Assert.True(first.TryGetProperty("moduleCount", out _));
    }

    [Fact]
    public async Task GetModules_ReturnsModulesForWorld()
    {
        var jwt = await GetAuthToken();

        var worldsResponse = await SendAuthenticated(HttpMethod.Get, "/api/worlds", jwt);
        var worlds = await worldsResponse.Content.ReadFromJsonAsync<JsonElement[]>();
        var worldId = worlds![0].GetProperty("id").GetString()!;

        var response = await SendAuthenticated(HttpMethod.Get, $"/api/worlds/{worldId}/modules", jwt);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var modules = await response.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(modules);
        Assert.NotEmpty(modules);

        var first = modules[0];
        Assert.True(first.TryGetProperty("id", out _));
        Assert.True(first.TryGetProperty("name", out _));
        Assert.True(first.TryGetProperty("lessonCount", out _));
    }

    [Fact]
    public async Task GetLesson_ReturnsContentMarkdown()
    {
        var jwt = await GetAuthToken();

        // worlds → modules → lessons → lesson detail
        var worldsResponse = await SendAuthenticated(HttpMethod.Get, "/api/worlds", jwt);
        var worlds = await worldsResponse.Content.ReadFromJsonAsync<JsonElement[]>();
        var worldId = worlds![0].GetProperty("id").GetString()!;

        var modulesResponse = await SendAuthenticated(HttpMethod.Get, $"/api/worlds/{worldId}/modules", jwt);
        var modules = await modulesResponse.Content.ReadFromJsonAsync<JsonElement[]>();
        var moduleId = modules![0].GetProperty("id").GetString()!;

        var lessonsResponse = await SendAuthenticated(HttpMethod.Get, $"/api/modules/{moduleId}/lessons", jwt);
        var lessons = await lessonsResponse.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(lessons);
        Assert.NotEmpty(lessons);

        var lessonId = lessons[0].GetProperty("id").GetString()!;
        var lessonResponse = await SendAuthenticated(HttpMethod.Get, $"/api/lessons/{lessonId}", jwt);
        Assert.Equal(HttpStatusCode.OK, lessonResponse.StatusCode);

        var lesson = await lessonResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(lesson.TryGetProperty("contentMarkdown", out var content));
        Assert.False(string.IsNullOrEmpty(content.GetString()), "Lesson contentMarkdown should not be empty");
    }

    [Fact]
    public async Task GetWorldsUnauthenticated_Returns401()
    {
        var response = await _client.GetAsync("/api/worlds");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ================================================================
    // Helpers
    // ================================================================

    private async Task<HttpResponseMessage> RegisterUser(string? username = null)
    {
        username ??= $"u_{Guid.NewGuid().ToString("N")[..8]}";
        var payload = new
        {
            username,
            email = $"{username}@test.com",
            password = "TestPass123",
            displayName = $"Test {username}"
        };
        return await _client.PostAsJsonAsync("/api/auth/register", payload);
    }

    private async Task<string> GetAuthToken()
    {
        var uniqueId = Guid.NewGuid().ToString("N")[..8];
        var response = await RegisterUser($"auth_{uniqueId}");
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("token").GetString()!;
    }

    private async Task<HttpResponseMessage> SendAuthenticated(
        HttpMethod method, string url, string jwt, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await _client.SendAsync(request);
    }
}

