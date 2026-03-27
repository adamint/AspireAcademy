using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using AspireAcademy.Api.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

public class GamificationEndpointsTests : TestFixture
{
    // ── XP Stats ──

    [Fact]
    public async Task GetXpStats_Authenticated_ReturnsOk()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/xp");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("totalXp").GetInt32().Should().BeGreaterThanOrEqualTo(0);
        body.GetProperty("currentLevel").GetInt32().Should().BeGreaterThanOrEqualTo(1);
        body.GetProperty("currentRank").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("recentEvents").GetArrayLength().Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task GetXpStats_Unauthenticated_Returns401()
    {
        var response = await Client.GetAsync("/api/xp");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Achievements ──

    [Fact]
    public async Task GetAchievements_Authenticated_ReturnsOk()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/achievements");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        // Should return an array (may be empty if no achievements seeded)
        body.ValueKind.Should().Be(JsonValueKind.Array);
    }

    [Fact]
    public async Task GetAchievements_Unauthenticated_ReturnsOk()
    {
        // Achievements endpoint is intentionally public (shows catalog)
        var response = await Client.GetAsync("/api/achievements");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── Complete Lesson ──

    [Fact]
    public async Task CompleteLesson_NonexistentLesson_Returns404()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PostAsJsonAsync("/api/progress/complete",
            new ProgressCompleteRequest("nonexistent-lesson"));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CompleteLesson_QuizLesson_Returns400()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        // lesson-quiz-1 is a quiz type, not a learn type
        var response = await client.PostAsJsonAsync("/api/progress/complete",
            new ProgressCompleteRequest("lesson-quiz-1"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CompleteLesson_LockedLesson_Returns403()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        // lesson-locked-1 requires lesson-challenge-1 which is not completed
        var response = await client.PostAsJsonAsync("/api/progress/complete",
            new ProgressCompleteRequest("lesson-locked-1"));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task CompleteLesson_ValidLearnLesson_AwardsXp()
    {
        // Use a separate user so we don't conflict with other tests
        var userId = Guid.Parse("66666666-6666-6666-6666-666666666666");
        await SeedUser(userId, "xpuser");

        using var client = CreateAuthenticatedClient(userId, "xpuser");

        var response = await client.PostAsJsonAsync("/api/progress/complete",
            new ProgressCompleteRequest("lesson-learn-1"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<ProgressCompleteResponse>(response);
        body!.XpEarned.Should().Be(50);
        body.TotalXp.Should().BeGreaterThanOrEqualTo(50);
    }

    // ── Avatar ──

    [Fact]
    public async Task RandomizeAvatar_ReturnsNewUrl()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PostAsync("/api/avatar/randomize", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("avatarUrl").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task ClearAvatar_ReturnsGravatarUrl()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.DeleteAsync("/api/avatar");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("avatarUrl").GetString().Should().Contain("gravatar");
    }

    [Fact]
    public async Task RandomizeAvatar_Unauthenticated_Returns401()
    {
        var response = await Client.PostAsync("/api/avatar/randomize", null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
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
