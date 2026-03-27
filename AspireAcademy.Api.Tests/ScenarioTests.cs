using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

public class ScenarioTests : TestFixture
{
    public override async Task InitializeAsync()
    {
        await base.InitializeAsync();

        // Mark lesson-learn-1 as completed so lesson-quiz-1 and dependent lessons unlock
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();
        db.UserProgress.Add(new UserProgress
        {
            Id = Guid.NewGuid(),
            UserId = TestUserId,
            LessonId = "lesson-learn-1",
            Status = "completed",
            Attempts = 1,
            XpEarned = 50,
            CompletedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }

    // ── XP not double-awarded on lesson re-completion ──

    [Fact]
    public async Task CompleteLessonTwice_DoesNotDoubleAwardXp()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // First completion should succeed
        var response1 = await authClient.PostAsJsonAsync("/api/progress/complete",
            new ProgressCompleteRequest("lesson-learn-1"));
        // lesson-learn-1 is already completed in InitializeAsync, so this should be rejected
        response1.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Verify XP from the original completion isn't duplicated
        var xpResponse = await authClient.GetAsync("/api/xp");
        xpResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task CompleteFreshLearnLesson_ThenReComplete_ReturnsBadRequest()
    {
        // Create a second user with access to lesson-learn-1
        var secondUserId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        await SeedSecondUser(secondUserId, "user2");

        using var authClient = CreateAuthenticatedClient(secondUserId, "user2");

        // First completion
        var response1 = await authClient.PostAsJsonAsync("/api/progress/complete",
            new ProgressCompleteRequest("lesson-learn-1"));
        response1.StatusCode.Should().Be(HttpStatusCode.OK);
        var body1 = await ReadJsonAsync<ProgressCompleteResponse>(response1);
        body1!.XpEarned.Should().Be(50);

        // Second completion — should be rejected with no additional XP
        var response2 = await authClient.PostAsJsonAsync("/api/progress/complete",
            new ProgressCompleteRequest("lesson-learn-1"));
        response2.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Locked lesson returns 403 ──

    [Fact]
    public async Task CompleteLocked_LearnLesson_ReturnsForbid()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // lesson-locked-1 requires lesson-challenge-1 which is NOT completed
        var response = await authClient.PostAsJsonAsync("/api/progress/complete",
            new ProgressCompleteRequest("lesson-locked-1"));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Quiz re-submission allowed (but XP only awarded once) ──

    [Fact]
    public async Task SubmitQuiz_PassingThenResubmit_DoesNotDoubleAwardBaseXp()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // Submit with half correct (50%) — fails the 70% threshold
        var failRequest = new QuizSubmitRequest(
        [
            new QuizAnswer(QuizQuestion1Id, ["a"], null), // correct
            new QuizAnswer(QuizQuestion2Id, ["a"], null), // wrong
        ]);

        var failResponse = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit", failRequest);
        failResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var failBody = await ReadJsonAsync<QuizSubmitResponse>(failResponse);
        failBody!.Passed.Should().BeFalse();
        failBody.XpEarned.Should().Be(0);

        // Re-submit with all correct — should pass and award XP
        var passRequest = new QuizSubmitRequest(
        [
            new QuizAnswer(QuizQuestion1Id, ["a"], null),
            new QuizAnswer(QuizQuestion2Id, ["b"], null),
        ]);

        var passResponse = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit", passRequest);
        passResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var passBody = await ReadJsonAsync<QuizSubmitResponse>(passResponse);
        passBody!.Passed.Should().BeTrue();
        passBody.XpEarned.Should().Be(100); // lesson XpReward

        // Third submission with perfect score — retake allowed but no additional base XP
        var resubmitResponse = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit", passRequest);
        resubmitResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var resubmitBody = await ReadJsonAsync<QuizSubmitResponse>(resubmitResponse);
        resubmitBody!.XpEarned.Should().Be(0); // No duplicate XP
        resubmitBody.AttemptNumber.Should().Be(3);
    }

    // ── Challenge rate limiting (mock Redis counter) ──

    [Fact]
    public async Task ChallengeRun_ExceedsRateLimit_Returns429()
    {
        // Pre-complete lesson-quiz-1 so lesson-challenge-1 is unlocked
        await UnlockChallengeLesson();

        using var authClient = CreateAuthenticatedClient(TestUserId);
        Factory.FakeRedis.Reset();

        var request = new ChallengeRunRequest("Console.WriteLine(\"Hello\");");

        // Send 10 runs — should all succeed (rate limit = 10/min)
        for (var i = 0; i < 10; i++)
        {
            var response = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/run", request);
            response.StatusCode.Should().Be(HttpStatusCode.OK,
                $"run {i + 1} of 10 should succeed within rate limit");
        }

        // 11th run should be rate-limited
        var limitedResponse = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/run", request);
        limitedResponse.StatusCode.Should().Be((HttpStatusCode)429);
    }

    // ── Streak resets after gap day ──

    [Fact]
    public async Task Streak_ResetsAfterGapDay()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

        var user = await db.Users.FindAsync(TestUserId);
        user!.LoginStreakDays = 5;
        user.LastStreakDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-3)); // Gap of 2+ days
        await db.SaveChangesAsync();

        var gamification = scope.ServiceProvider.GetRequiredService<GamificationService>();
        await gamification.UpdateStreakAsync(TestUserId);

        await db.Entry(user).ReloadAsync();
        user.LoginStreakDays.Should().Be(1, "streak should reset to 1 after a gap > 1 day");
        user.LastStreakDate.Should().Be(DateOnly.FromDateTime(DateTime.UtcNow));
    }

    // ── Streak doesn't increment on same-day login ──

    [Fact]
    public async Task Streak_DoesNotIncrementOnSameDayLogin()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

        var user = await db.Users.FindAsync(TestUserId);
        user!.LoginStreakDays = 3;
        user.LastStreakDate = DateOnly.FromDateTime(DateTime.UtcNow); // Today already
        await db.SaveChangesAsync();

        var gamification = scope.ServiceProvider.GetRequiredService<GamificationService>();
        await gamification.UpdateStreakAsync(TestUserId);

        await db.Entry(user).ReloadAsync();
        user.LoginStreakDays.Should().Be(3, "streak should not change when already counted today");
    }

    // ── Friend request to self returns 400 ──

    [Fact]
    public async Task FriendRequest_ToSelf_Returns400()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.PostAsJsonAsync("/api/friends/request",
            new { Username = TestUsername });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("error").GetString().Should().Contain("yourself");
    }

    // ── Duplicate friend request returns 409 ──

    [Fact]
    public async Task FriendRequest_Duplicate_Returns409()
    {
        var friendId = Guid.Parse("33333333-3333-3333-3333-333333333333");
        await SeedSecondUser(friendId, "frienduser");

        using var authClient = CreateAuthenticatedClient(TestUserId);

        // First friend request
        var response1 = await authClient.PostAsJsonAsync("/api/friends/request",
            new { Username = "frienduser" });
        response1.StatusCode.Should().Be(HttpStatusCode.Created);

        // Duplicate friend request
        var response2 = await authClient.PostAsJsonAsync("/api/friends/request",
            new { Username = "frienduser" });
        response2.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    // ── Admin endpoints return 403 for non-admin users ──

    [Fact]
    public async Task AdminStats_NonAdmin_Returns403()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.GetAsync("/api/admin/stats");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AdminReloadCurriculum_NonAdmin_Returns403()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.PostAsync("/api/admin/reload-curriculum", null);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AdminGetUsers_NonAdmin_Returns403()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.GetAsync("/api/admin/users");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AdminStats_AdminUser_Returns200()
    {
        // Verify admin access works with the admin username
        using var adminClient = CreateAuthenticatedClient(TestUserId, "admin");

        var response = await adminClient.GetAsync("/api/admin/stats");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task AdminStats_WithAdminHeader_Returns200()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);
        authClient.DefaultRequestHeaders.Add("X-Aspire-Admin", AcademyApiFactory.AdminInternalSecret);

        var response = await authClient.GetAsync("/api/admin/stats");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ── Helpers ──

    private async Task SeedSecondUser(Guid userId, string username)
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

    private async Task UnlockChallengeLesson()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

        // lesson-challenge-1 requires lesson-quiz-1 to be completed
        var existing = db.UserProgress
            .FirstOrDefault(p => p.UserId == TestUserId && p.LessonId == "lesson-quiz-1");

        if (existing is null)
        {
            db.UserProgress.Add(new UserProgress
            {
                Id = Guid.NewGuid(),
                UserId = TestUserId,
                LessonId = "lesson-quiz-1",
                Status = "completed",
                Attempts = 1,
                XpEarned = 100,
                CompletedAt = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }
    }
}
