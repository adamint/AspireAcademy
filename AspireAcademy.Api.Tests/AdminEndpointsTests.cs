using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

public class AdminEndpointsTests : TestFixture
{
    // ── Stats ──

    [Fact]
    public async Task GetStats_AsAdmin_ReturnsStatsWithCorrectShape()
    {
        using var client = CreateAuthenticatedClient(TestUserId, "admin");

        var response = await client.GetAsync("/api/admin/stats");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("totalUsers").GetInt32().Should().BeGreaterThanOrEqualTo(1);
        body.GetProperty("worldsCount").GetInt32().Should().BeGreaterThanOrEqualTo(1);
        body.GetProperty("modulesCount").GetInt32().Should().BeGreaterThanOrEqualTo(1);
        body.GetProperty("lessonsCount").GetInt32().Should().BeGreaterThanOrEqualTo(1);
    }

    // ── Get Users ──

    [Fact]
    public async Task GetUsers_AsAdmin_ReturnsPaginatedList()
    {
        using var client = CreateAuthenticatedClient(TestUserId, "admin");

        var response = await client.GetAsync("/api/admin/users?page=1&pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("users").GetArrayLength().Should().BeGreaterThanOrEqualTo(1);
        body.GetProperty("totalCount").GetInt32().Should().BeGreaterThanOrEqualTo(1);
        body.GetProperty("page").GetInt32().Should().Be(1);
    }

    [Fact]
    public async Task GetUsers_WithSearch_FiltersResults()
    {
        using var client = CreateAuthenticatedClient(TestUserId, "admin");

        var response = await client.GetAsync("/api/admin/users?search=testuser");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("totalCount").GetInt32().Should().BeGreaterThanOrEqualTo(1);
    }

    // ── Delete User ──

    [Fact]
    public async Task DeleteUser_AsAdmin_ExistingUser_Succeeds()
    {
        // Seed a disposable user
        var disposableId = Guid.Parse("77777777-7777-7777-7777-777777777777");
        await SeedUser(disposableId, "disposable");

        using var client = CreateAuthenticatedClient(TestUserId, "admin");

        var response = await client.DeleteAsync($"/api/admin/users/{disposableId}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task DeleteUser_AsAdmin_NonexistentUser_Returns404()
    {
        using var client = CreateAuthenticatedClient(TestUserId, "admin");

        var response = await client.DeleteAsync($"/api/admin/users/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeleteUser_AsNonAdmin_Returns403()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.DeleteAsync($"/api/admin/users/{TestUserId}");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Seed Test Data ──

    [Fact]
    public async Task SeedTestData_AsAdmin_Creates_TestUser()
    {
        using var client = CreateAuthenticatedClient(TestUserId, "admin");

        // "testuser" already exists from fixture seeding, so should get Conflict
        var response = await client.PostAsync("/api/admin/seed-test-data", null);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // ── Seeded Credentials ──

    [Fact]
    public async Task GetSeededCredentials_AsAdmin_ReturnsCredentials()
    {
        using var client = CreateAuthenticatedClient(TestUserId, "admin");

        var response = await client.GetAsync("/api/admin/seeded-credentials");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task GetSeededCredentials_AsNonAdmin_Returns403()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/admin/seeded-credentials");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Reload Curriculum ──

    [Fact]
    public async Task ReloadCurriculum_AsAdmin_Succeeds()
    {
        using var client = CreateAuthenticatedClient(TestUserId, "admin");

        var response = await client.PostAsync("/api/admin/reload-curriculum", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("message").GetString().Should().Contain("reloaded");
    }

    // \u2500\u2500 Admin via X-Aspire-Admin header \u2500\u2500

    [Fact]
    public async Task AdminEndpoint_ViaAspireHeader_Succeeds()
    {
        using var client = CreateAuthenticatedClient(TestUserId);
        client.DefaultRequestHeaders.Add("X-Aspire-Admin", AcademyApiFactory.AdminInternalSecret);

        var response = await client.GetAsync("/api/admin/stats");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── Helpers ──

    private async Task SeedUser(Guid userId, string username)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

        if (await db.Users.FindAsync(userId) is not null)
        {
            return;
        }

        db.Users.Add(new User
        {
            Id = userId,
            Username = username,
            Email = $"{username}@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password1"),
            DisplayName = $"Test {username}",
            CreatedAt = DateTime.UtcNow,
            LoginStreakDays = 0
        });

        db.UserXp.Add(new UserXp
        {
            UserId = userId,
            TotalXp = 0,
            CurrentLevel = 1,
            CurrentRank = "aspire-intern",
            WeeklyXp = 0,
            WeekStart = DateOnly.FromDateTime(DateTime.UtcNow)
        });

        await db.SaveChangesAsync();
    }
}
