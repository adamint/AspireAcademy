using System.Net;
using System.Net.Http.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using AspireAcademy.Api.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

public class QuizEndpointsTests : TestFixture
{
    public override async Task InitializeAsync()
    {
        await base.InitializeAsync();

        // Mark lesson-learn-1 as completed so lesson-quiz-1 is unlocked
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

    [Fact]
    public async Task SubmitQuiz_WithAllCorrectAnswers_PassesWithXpAndPerfectBonus()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var request = new QuizSubmitRequest(
        [
            new QuizAnswer(QuizQuestion1Id, ["a"], null),
            new QuizAnswer(QuizQuestion2Id, ["b"], null),
        ]);

        var response = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<QuizSubmitResponse>(response);
        body.Should().NotBeNull();
        body!.Score.Should().Be(100);
        body.Passed.Should().BeTrue();
        body.IsPerfect.Should().BeTrue();
        body.XpEarned.Should().Be(100); // lesson XpReward
        body.BonusXpEarned.Should().Be(25); // lesson BonusXp for perfect
        body.Results.Should().HaveCount(2);
        body.Results.Should().AllSatisfy(r => r.Correct.Should().BeTrue());
        body.TotalXp.Should().BeGreaterThan(0);
        body.CurrentLevel.Should().BeGreaterThanOrEqualTo(1);
        body.CurrentRank.Should().NotBeNullOrEmpty();
        body.WeeklyXp.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task SubmitQuiz_WithAllWrongAnswers_FailsBelowThreshold()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var request = new QuizSubmitRequest(
        [
            new QuizAnswer(QuizQuestion1Id, ["b"], null), // wrong
            new QuizAnswer(QuizQuestion2Id, ["a"], null), // wrong
        ]);

        var response = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<QuizSubmitResponse>(response);
        body.Should().NotBeNull();
        body!.Score.Should().Be(0);
        body.Passed.Should().BeFalse();
        body.XpEarned.Should().Be(0);
        body.BonusXpEarned.Should().Be(0);
    }

    [Fact]
    public async Task SubmitQuiz_PerfectScore_AwardsBonusXp()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var request = new QuizSubmitRequest(
        [
            new QuizAnswer(QuizQuestion1Id, ["a"], null),
            new QuizAnswer(QuizQuestion2Id, ["b"], null),
        ]);

        var response = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit", request);
        var body = await ReadJsonAsync<QuizSubmitResponse>(response);

        body!.IsPerfect.Should().BeTrue();
        body.BonusXpEarned.Should().BeGreaterThan(0);
        body.BonusXpEarned.Should().Be(25);
    }

    [Fact]
    public async Task SubmitQuiz_DoubleCompletion_DoesNotDoubleAwardXp()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var request = new QuizSubmitRequest(
        [
            new QuizAnswer(QuizQuestion1Id, ["a"], null),
            new QuizAnswer(QuizQuestion2Id, ["b"], null),
        ]);

        // First submission: perfect score, should award XP
        var response1 = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit", request);
        var body1 = await ReadJsonAsync<QuizSubmitResponse>(response1);
        body1!.Passed.Should().BeTrue();
        body1.XpEarned.Should().BeGreaterThan(0);
        body1.AttemptNumber.Should().Be(1);

        // Second submission: retake allowed but no additional XP
        var response2 = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit", request);
        response2.StatusCode.Should().Be(HttpStatusCode.OK);
        var body2 = await ReadJsonAsync<QuizSubmitResponse>(response2);
        body2!.XpEarned.Should().Be(0);
        body2.BonusXpEarned.Should().Be(0);
        body2.AttemptNumber.Should().Be(2);
    }

    [Fact]
    public async Task SubmitQuiz_Retake_TracksAttemptHistory()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // First attempt: all wrong
        var wrongRequest = new QuizSubmitRequest(
        [
            new QuizAnswer(QuizQuestion1Id, ["b"], null),
            new QuizAnswer(QuizQuestion2Id, ["a"], null),
        ]);
        var response1 = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit", wrongRequest);
        var body1 = await ReadJsonAsync<QuizSubmitResponse>(response1);
        body1!.AttemptNumber.Should().Be(1);
        body1.Passed.Should().BeFalse();

        // Second attempt: all correct
        var correctRequest = new QuizSubmitRequest(
        [
            new QuizAnswer(QuizQuestion1Id, ["a"], null),
            new QuizAnswer(QuizQuestion2Id, ["b"], null),
        ]);
        var response2 = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit", correctRequest);
        var body2 = await ReadJsonAsync<QuizSubmitResponse>(response2);
        body2!.AttemptNumber.Should().Be(2);
        body2.Passed.Should().BeTrue();
        body2.XpEarned.Should().BeGreaterThan(0);

        // Check history
        var historyResponse = await authClient.GetAsync("/api/quizzes/lesson-quiz-1/history");
        historyResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var history = await ReadJsonAsync<List<QuizAttemptDto>>(historyResponse);
        history.Should().HaveCount(2);
        history![0].AttemptNumber.Should().Be(2); // Most recent first
        history[1].AttemptNumber.Should().Be(1);
    }

    [Fact]
    public async Task GetQuizHistory_ReturnsEmptyForNewUser()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.GetAsync("/api/quizzes/lesson-quiz-1/history");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var history = await ReadJsonAsync<List<QuizAttemptDto>>(response);
        history.Should().BeEmpty();
    }

    [Fact]
    public async Task SubmitQuiz_ForLockedLesson_ReturnsForbid()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // lesson-locked-quiz requires lesson-challenge-1 which is NOT completed → Forbid
        var lockedQuestionId = Guid.Parse("00000000-0000-0000-0000-000000000099");
        var request = new QuizSubmitRequest([new QuizAnswer(lockedQuestionId, ["a"], null)]);

        var response = await authClient.PostAsJsonAsync("/api/quizzes/lesson-locked-quiz/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SubmitQuiz_TotalXpIncludesAchievementBonusXp()
    {
        // Use a fresh user with prerequisites completed
        var userId = Guid.Parse("88888888-8888-8888-8888-888888888888");
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

            db.Users.Add(new User
            {
                Id = userId,
                Username = "quizachuser",
                Email = "quizachuser@example.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password1"),
                DisplayName = "Quiz Ach User",
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

            // Prereq: lesson-learn-1 completed so quiz is unlocked
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

            // Seed an achievement that triggers on first quiz pass
            if (!db.Achievements.Any(a => a.Id == "test-quiz-pass-ach"))
            {
                db.Achievements.Add(new Achievement
                {
                    Id = "test-quiz-pass-ach",
                    Name = "Quiz Whiz",
                    Description = "Pass your first quiz",
                    Icon = "📝",
                    Category = "milestone",
                    TriggerType = "quiz-pass",
                    TriggerConfig = System.Text.Json.JsonDocument.Parse("{\"count\":1}"),
                    XpReward = 40,
                    Rarity = "common",
                    SortOrder = 1
                });
            }

            await db.SaveChangesAsync();
        }

        using var authClient = CreateAuthenticatedClient(userId, "quizachuser");

        var request = new QuizSubmitRequest(
        [
            new QuizAnswer(QuizQuestion1Id, ["a"], null),
            new QuizAnswer(QuizQuestion2Id, ["b"], null),
        ]);

        var response = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<QuizSubmitResponse>(response);
        body!.Passed.Should().BeTrue();
        body.XpEarned.Should().Be(100); // base quiz XP
        body.AchievementsUnlocked.Should().Contain(a => a.Id == "test-quiz-pass-ach");
        // TotalXp must include base (100) + perfect bonus (25) + achievement bonus (40) = 165
        body.TotalXp.Should().Be(165);
    }

    [Fact]
    public async Task SubmitQuiz_WithoutAuth_Returns401()
    {
        var request = new QuizSubmitRequest([]);
        var response = await Client.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
