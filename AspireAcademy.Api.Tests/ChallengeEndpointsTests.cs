using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using AspireAcademy.Api.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

public class ChallengeEndpointsTests : TestFixture
{
    public override async Task InitializeAsync()
    {
        await base.InitializeAsync();

        // Complete prerequisites so the challenge lesson is unlocked:
        // lesson-learn-1 → lesson-quiz-1 → lesson-challenge-1
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();
        db.UserProgress.AddRange(
            new UserProgress
            {
                Id = Guid.NewGuid(),
                UserId = TestUserId,
                LessonId = "lesson-learn-1",
                Status = "completed",
                Attempts = 1,
                XpEarned = 50,
                CompletedAt = DateTime.UtcNow
            },
            new UserProgress
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

    [Fact]
    public async Task RunCode_ReturnsStructuralValidationResult()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var request = new ChallengeRunRequest("Console.WriteLine(\"Hello World\");", 0);
        var response = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/run", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<ChallengeRunResponse>(response);
        body.Should().NotBeNull();
        body!.CompilationSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task SubmitChallenge_WithPassingCode_AllApplicableTestsPassAndXpAwarded()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // This code passes both "compiles" (valid structure) and "output-contains" is skipped,
        // but the seed data test cases are "compiles" + "output-contains".
        // "output-contains" is skipped (runtime), so only "compiles" is applicable.
        var request = new ChallengeRunRequest("Console.WriteLine(\"Hello World\");", 0);
        var response = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<ChallengeSubmitResponse>(response);
        body.Should().NotBeNull();
        body!.CompilationSuccess.Should().BeTrue();
        body.AllPassed.Should().BeTrue();
        body.TestResults.Should().HaveCount(2);
        // "compiles" should pass, "output-contains" is skipped (marked as failed)
        body.TestResults.Should().Contain(t => t.Name == "Compiles" && t.Passed);
        body.XpEarned.Should().Be(150); // lesson XpReward
    }

    [Fact]
    public async Task SubmitChallenge_WithBrokenCode_ShowsTestFailures()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // Unbalanced braces → structure invalid
        var request = new ChallengeRunRequest("if (true) {", 0);
        var response = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<ChallengeSubmitResponse>(response);
        body.Should().NotBeNull();
        body!.CompilationSuccess.Should().BeFalse();
        body.AllPassed.Should().BeFalse();
        // The "compiles" test case should fail
        body.TestResults.Should().Contain(t => t.Name == "Compiles" && !t.Passed);
    }

    [Fact]
    public async Task RunCode_RateLimiting_Returns429AfterExceedingLimit()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);
        var request = new ChallengeRunRequest("Console.WriteLine(\"hi\");", 0);

        // Make 10 requests (the limit)
        for (var i = 0; i < 10; i++)
        {
            var resp = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/run", request);
            resp.StatusCode.Should().Be(HttpStatusCode.OK, $"request {i + 1} should succeed");
        }

        // The 11th should be rate limited
        var rateLimitedResponse = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/run", request);
        rateLimitedResponse.StatusCode.Should().Be((HttpStatusCode)429);
    }

    [Fact]
    public async Task SubmitChallenge_TotalXpIncludesAchievementBonusXp()
    {
        // Use a fresh user with prerequisites completed
        var userId = Guid.Parse("99999999-9999-9999-9999-999999999999");
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

            db.Users.Add(new User
            {
                Id = userId,
                Username = "chalachuser",
                Email = "chalachuser@example.com",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password1"),
                DisplayName = "Chal Ach User",
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

            // Prerequisites: lesson-learn-1 and lesson-quiz-1 completed
            db.UserProgress.AddRange(
                new UserProgress
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    LessonId = "lesson-learn-1",
                    Status = "completed",
                    Attempts = 1,
                    XpEarned = 50,
                    CompletedAt = DateTime.UtcNow
                },
                new UserProgress
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    LessonId = "lesson-quiz-1",
                    Status = "completed",
                    Attempts = 1,
                    XpEarned = 100,
                    CompletedAt = DateTime.UtcNow
                });

            // Seed an achievement that triggers after 3 lessons completed
            if (!db.Achievements.Any(a => a.Id == "test-three-lessons-ach"))
            {
                db.Achievements.Add(new Achievement
                {
                    Id = "test-three-lessons-ach",
                    Name = "Three Lessons",
                    Description = "Complete three lessons",
                    Icon = "📚",
                    Category = "milestone",
                    TriggerType = "lesson-complete",
                    TriggerConfig = System.Text.Json.JsonDocument.Parse("{\"count\":3}"),
                    XpReward = 60,
                    Rarity = "common",
                    SortOrder = 1
                });
            }

            await db.SaveChangesAsync();
        }

        using var authClient = CreateAuthenticatedClient(userId, "chalachuser");

        var request = new ChallengeRunRequest("Console.WriteLine(\"Hello World\");", 0);
        var response = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<ChallengeSubmitResponse>(response);
        body!.AllPassed.Should().BeTrue();
        body.XpEarned.Should().Be(150); // base challenge XP
        body.AchievementsUnlocked.Should().Contain(a => a.Id == "test-three-lessons-ach");
        // TotalXp must include base (150) + first-try bonus (50) + achievement bonus (60) = 260
        body.TotalXp.Should().Be(260);
    }

    [Fact]
    public async Task SubmitChallenge_WithoutAuth_Returns401()
    {
        var request = new ChallengeRunRequest("code", 0);
        var response = await Client.PostAsJsonAsync("/api/challenges/lesson-challenge-1/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SubmitChallenge_WithYamlFormatTestCases_PassesCorrectly()
    {
        // Seed a challenge using the YAML curriculum format (id, name, value instead of expected)
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

        var yamlLesson = new Lesson
        {
            Id = "lesson-yaml-challenge", ModuleId = "mod-1", Title = "YAML Challenge",
            Description = "Test YAML format", Type = "challenge", SortOrder = 10,
            ContentMarkdown = "# YAML", XpReward = 100, BonusXp = 0, EstimatedMinutes = 5,
            UnlockAfterLessonId = null, IsBoss = false
        };
        db.Lessons.Add(yamlLesson);

        db.CodeChallenges.Add(new CodeChallenge
        {
            Id = Guid.NewGuid(),
            LessonId = "lesson-yaml-challenge",
            InstructionsMarkdown = "Add Redis",
            StarterCode = "// code here",
            SolutionCode = "builder.AddRedis(\"cache\");",
            TestCases = JsonDocument.Parse("""
            [
                {"id":"t1","name":"Must call AddRedis","type":"code-contains","description":"Must call AddRedis with cache","value":"AddRedis(\"cache\")"},
                {"id":"t2","name":"Must call Build","type":"code-contains","description":"Must call Build().Run()","value":"Build().Run()"}
            ]
            """),
            Hints = JsonDocument.Parse("[]"),
            RequiredPackages = JsonDocument.Parse("[]"),
            SortOrder = 0
        });
        await db.SaveChangesAsync();

        using var authClient = CreateAuthenticatedClient(TestUserId);
        var code = """
            var builder = DistributedApplication.CreateBuilder(args);
            builder.AddRedis("cache");
            builder.Build().Run();
            """;
        var request = new ChallengeRunRequest(code, 0);
        var response = await authClient.PostAsJsonAsync("/api/challenges/lesson-yaml-challenge/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<ChallengeSubmitResponse>(response);
        body.Should().NotBeNull();
        body!.AllPassed.Should().BeTrue();
        body.TestResults.Should().HaveCount(2);
        body.TestResults.Should().OnlyContain(t => t.Passed);
        body.TestResults[0].TestId.Should().Be("t1");
        body.TestResults[0].Name.Should().Be("Must call AddRedis");
    }

    // ── Skip Challenge ──

    [Fact]
    public async Task SkipChallenge_ReturnsSolutionCode()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.PostAsync("/api/challenges/lesson-challenge-1/skip", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<ChallengeSkipResponse>(response);
        body.Should().NotBeNull();
        body!.Skipped.Should().BeTrue();
        body.LessonId.Should().Be("lesson-challenge-1");
        body.SolutionCodes.Should().NotBeEmpty();
        body.SolutionCodes[0].Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task SkipChallenge_DoesNotAwardXp()
    {
        var userId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        await SeedUser(userId, "skipchallxp");

        // Seed prerequisites
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();
            db.UserProgress.AddRange(
                new UserProgress { Id = Guid.NewGuid(), UserId = userId, LessonId = "lesson-learn-1", Status = "completed", Attempts = 1, XpEarned = 50, CompletedAt = DateTime.UtcNow },
                new UserProgress { Id = Guid.NewGuid(), UserId = userId, LessonId = "lesson-quiz-1", Status = "completed", Attempts = 1, XpEarned = 100, CompletedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }

        using var authClient = CreateAuthenticatedClient(userId, "skipchallxp");

        var xpBefore = await authClient.GetFromJsonAsync<JsonElement>("/api/xp");
        var initialXp = xpBefore.GetProperty("totalXp").GetInt32();

        await authClient.PostAsync("/api/challenges/lesson-challenge-1/skip", null);

        var xpAfter = await authClient.GetFromJsonAsync<JsonElement>("/api/xp");
        xpAfter.GetProperty("totalXp").GetInt32().Should().Be(initialXp);
    }

    [Fact]
    public async Task SkipChallenge_AlreadyCompleted_Returns400()
    {
        // Use a fresh user - complete the challenge first, then try to skip
        var userId = Guid.Parse("55555555-5555-5555-5555-555555555555");
        await SeedUser(userId, "skipaftercomp");

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();
            db.UserProgress.AddRange(
                new UserProgress { Id = Guid.NewGuid(), UserId = userId, LessonId = "lesson-learn-1", Status = "completed", Attempts = 1, XpEarned = 50, CompletedAt = DateTime.UtcNow },
                new UserProgress { Id = Guid.NewGuid(), UserId = userId, LessonId = "lesson-quiz-1", Status = "completed", Attempts = 1, XpEarned = 100, CompletedAt = DateTime.UtcNow },
                new UserProgress { Id = Guid.NewGuid(), UserId = userId, LessonId = "lesson-challenge-1", Status = "completed", Attempts = 1, XpEarned = 150, CompletedAt = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }

        using var authClient = CreateAuthenticatedClient(userId, "skipaftercomp");

        var response = await authClient.PostAsync("/api/challenges/lesson-challenge-1/skip", null);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SkipChallenge_AlreadySkipped_ReturnsSolutionAgain()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // Skip once
        var resp1 = await authClient.PostAsync("/api/challenges/lesson-challenge-1/skip", null);
        resp1.StatusCode.Should().Be(HttpStatusCode.OK);

        // Skip again — idempotent
        var resp2 = await authClient.PostAsync("/api/challenges/lesson-challenge-1/skip", null);
        resp2.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<ChallengeSkipResponse>(resp2);
        body!.Skipped.Should().BeTrue();
        body.SolutionCodes.Should().NotBeEmpty();
    }

    [Fact]
    public async Task SkipChallenge_NonexistentLesson_Returns404()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.PostAsync("/api/challenges/nonexistent/skip", null);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SkipChallenge_Unauthenticated_Returns401()
    {
        var response = await Client.PostAsync("/api/challenges/lesson-challenge-1/skip", null);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    private async Task SeedUser(Guid userId, string username)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

        if (await db.Users.FindAsync(userId) is not null)
            return;

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
