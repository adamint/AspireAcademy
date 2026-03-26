using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using AspireAcademy.Api.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

public class SkipLessonTests : TestFixture
{
    // ── Skip ──

    [Fact]
    public async Task SkipLesson_NonexistentLesson_Returns404()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PostAsJsonAsync("/api/progress/skip",
            new SkipRequest("nonexistent"));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SkipLesson_ValidLesson_ReturnsSkipped()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PostAsJsonAsync("/api/progress/skip",
            new SkipRequest("lesson-learn-1"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("skipped").GetBoolean().Should().BeTrue();
        body.GetProperty("lessonId").GetString().Should().Be("lesson-learn-1");
    }

    [Fact]
    public async Task SkipLesson_DoesNotAwardXp()
    {
        var userId = Guid.Parse("77777777-7777-7777-7777-777777777777");
        await SeedUser(userId, "skipxpuser");

        using var client = CreateAuthenticatedClient(userId, "skipxpuser");

        // Get initial XP
        var xpBefore = await client.GetFromJsonAsync<JsonElement>("/api/xp");
        var initialXp = xpBefore.GetProperty("totalXp").GetInt32();

        // Skip lesson
        await client.PostAsJsonAsync("/api/progress/skip",
            new SkipRequest("lesson-learn-1"));

        // XP should not change
        var xpAfter = await client.GetFromJsonAsync<JsonElement>("/api/xp");
        xpAfter.GetProperty("totalXp").GetInt32().Should().Be(initialXp);
    }

    [Fact]
    public async Task SkipLesson_AlreadyCompleted_Returns400()
    {
        var userId = Guid.Parse("88888888-8888-8888-8888-888888888888");
        await SeedUser(userId, "skipcompuser");

        // Complete the lesson first
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();
        db.UserProgress.Add(new UserProgress
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            LessonId = "lesson-learn-1",
            Status = "completed",
            Attempts = 1,
            XpEarned = 50,
            CompletedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        using var client = CreateAuthenticatedClient(userId, "skipcompuser");

        var response = await client.PostAsJsonAsync("/api/progress/skip",
            new SkipRequest("lesson-learn-1"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SkipLesson_AlreadySkipped_ReturnsOk()
    {
        var userId = Guid.Parse("99999999-9999-9999-9999-999999999999");
        await SeedUser(userId, "skipdupuser");

        using var client = CreateAuthenticatedClient(userId, "skipdupuser");

        // Skip once
        var response1 = await client.PostAsJsonAsync("/api/progress/skip",
            new SkipRequest("lesson-learn-1"));
        response1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Skip again — idempotent
        var response2 = await client.PostAsJsonAsync("/api/progress/skip",
            new SkipRequest("lesson-learn-1"));
        response2.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task SkipLesson_Unauthenticated_Returns401()
    {
        var response = await Client.PostAsJsonAsync("/api/progress/skip",
            new SkipRequest("lesson-learn-1"));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Unskip ──

    [Fact]
    public async Task UnskipLesson_NotSkipped_Returns400()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PostAsJsonAsync("/api/progress/unskip",
            new SkipRequest("lesson-learn-1"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UnskipLesson_SkippedLesson_ReturnsUnskipped()
    {
        var userId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        await SeedUser(userId, "unskipuser");

        using var client = CreateAuthenticatedClient(userId, "unskipuser");

        // Skip first
        await client.PostAsJsonAsync("/api/progress/skip",
            new SkipRequest("lesson-learn-1"));

        // Unskip
        var response = await client.PostAsJsonAsync("/api/progress/unskip",
            new SkipRequest("lesson-learn-1"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("unskipped").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task UnskipLesson_ThenComplete_AwardsXp()
    {
        var userId = Guid.Parse("22222222-2222-2222-2222-222222222223");
        await SeedUser(userId, "unskipcompluser");

        using var client = CreateAuthenticatedClient(userId, "unskipcompluser");

        // Skip
        await client.PostAsJsonAsync("/api/progress/skip",
            new SkipRequest("lesson-learn-1"));

        // Unskip
        await client.PostAsJsonAsync("/api/progress/unskip",
            new SkipRequest("lesson-learn-1"));

        // Now complete — should award XP
        var response = await client.PostAsJsonAsync("/api/progress/complete",
            new ProgressCompleteRequest("lesson-learn-1"));
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await ReadJsonAsync<ProgressCompleteResponse>(response);
        body!.XpEarned.Should().Be(50);
    }

    // ── Skip Unlocks Next Lesson ──

    [Fact]
    public async Task SkipLesson_UnlocksNextLesson()
    {
        var userId = Guid.Parse("33333333-3333-3333-3333-333333333334");
        await SeedUser(userId, "skipunlockuser");

        using var client = CreateAuthenticatedClient(userId, "skipunlockuser");

        // lesson-quiz-1 requires lesson-learn-1 to be completed (or skipped)
        // Skip lesson-learn-1
        var skipResponse = await client.PostAsJsonAsync("/api/progress/skip",
            new SkipRequest("lesson-learn-1"));
        skipResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Now lesson-quiz-1 should be unlocked
        var lessonsResponse = await client.GetAsync("/api/modules/mod-1/lessons");
        var lessons = await ReadJsonAsync<List<LessonListDto>>(lessonsResponse);
        var quizLesson = lessons!.First(l => l.Id == "lesson-quiz-1");
        quizLesson.IsUnlocked.Should().BeTrue("skipping prereq should unlock next lesson");
    }

    // ── Skipped Status Appears In Lesson List ──

    [Fact]
    public async Task SkippedLesson_ShowsSkippedStatusInList()
    {
        var userId = Guid.Parse("44444444-4444-4444-4444-444444444445");
        await SeedUser(userId, "skipstatuser");

        using var client = CreateAuthenticatedClient(userId, "skipstatuser");

        await client.PostAsJsonAsync("/api/progress/skip",
            new SkipRequest("lesson-learn-1"));

        var lessonsResponse = await client.GetAsync("/api/modules/mod-1/lessons");
        var lessons = await ReadJsonAsync<List<LessonListDto>>(lessonsResponse);
        var skipped = lessons!.First(l => l.Id == "lesson-learn-1");
        skipped.Status.Should().Be("skipped");
    }

    // ── Preview Locked Lesson ──

    [Fact]
    public async Task GetLockedLesson_ReturnsContentWithIsLockedTrue()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        // lesson-locked-1 is locked (prereq lesson-challenge-1 not completed)
        var response = await client.GetAsync("/api/lessons/lesson-locked-1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("isLocked").GetBoolean().Should().BeTrue();
        body.GetProperty("contentMarkdown").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("title").GetString().Should().Be("Locked Lesson");
    }

    [Fact]
    public async Task GetUnlockedLesson_ReturnsIsLockedFalse()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/lessons/lesson-learn-1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("isLocked").GetBoolean().Should().BeFalse();
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
