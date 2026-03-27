using System.Security.Claims;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using AspireAcademy.Api.Telemetry;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

namespace AspireAcademy.Api.Endpoints;

// ── Request / Response DTOs ──

public record ChallengeRunRequest(string Code, int StepIndex = 0);

public record ChallengeRunResponse(
    bool CompilationSuccess,
    string CompilationOutput,
    string ExecutionOutput,
    int? ExecutionTimeMs,
    string? Error,
    List<string> ApiWarnings);

public record TestCaseResult(string TestId, string Name, bool Passed, string Description);

public record ChallengeSubmitResponse(
    bool CompilationSuccess,
    string CompilationOutput,
    string ExecutionOutput,
    int? ExecutionTimeMs,
    List<TestCaseResult> TestResults,
    bool AllPassed,
    int XpEarned,
    int BonusXpEarned,
    LevelUpInfo? LevelUp,
    List<AchievementUnlocked> AchievementsUnlocked);

public static class ChallengeEndpoints
{
    private const int MaxRunsPerMinute = 10;
    private static ILogger s_logger = null!;

    public static WebApplication MapChallengeEndpoints(this WebApplication app)
    {
        s_logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("ChallengeEndpoints");

        var group = app.MapGroup("/api/challenges").RequireAuthorization();

        group.MapPost("/{lessonId}/run", RunCodeAsync);
        group.MapPost("/{lessonId}/submit", SubmitChallengeAsync).RequireRateLimiting("social-write");

        return app;
    }

    private static async Task<IResult> RunCodeAsync(
        string lessonId,
        ChallengeRunRequest request,
        AcademyDbContext db,
        CodeCheckerService codeChecker,
        IConnectionMultiplexer redis,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);
        s_logger.LogInformation("Code run for LessonId={LessonId}, UserId={UserId}", lessonId, userId);

        // Rate limiting
        if (!await CheckRateLimitAsync(redis, userId))
        {
            return Results.StatusCode(429);
        }

        // Validate lesson exists
        var lesson = await db.Lessons
            .Include(l => l.CodeChallenges.OrderBy(c => c.SortOrder))
            .FirstOrDefaultAsync(l => l.Id == lessonId);

        if (lesson is null)
        {
            return Results.NotFound(new ErrorResponse("Lesson not found"));
        }

        if (!await EndpointHelpers.IsLessonUnlockedAsync(db, userId, lesson))
        {
            return Results.Forbid();
        }

        var challenge = lesson.CodeChallenges.ElementAtOrDefault(request.StepIndex);
        if (challenge is null)
        {
            return Results.BadRequest(new ErrorResponse("Invalid step index"));
        }

        // Static code check (no Docker container needed)
        var checkResult = codeChecker.Validate(request.Code, challenge.TestCases, challenge.RequiredPackages);

        return Results.Ok(new ChallengeRunResponse(
            CompilationSuccess: checkResult.StructureValid,
            CompilationOutput: checkResult.StructureErrors ?? "",
            ExecutionOutput: "",
            ExecutionTimeMs: null,
            Error: null,
            ApiWarnings: checkResult.ApiWarnings));
    }

    private static async Task<IResult> SubmitChallengeAsync(
        string lessonId,
        ChallengeRunRequest request,
        AcademyDbContext db,
        CodeCheckerService codeChecker,
        IConnectionMultiplexer redis,
        GamificationService gamification,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);
        s_logger.LogInformation("Code submit for LessonId={LessonId}, UserId={UserId}", lessonId, userId);
        AcademyMetrics.ChallengesSubmitted.Add(1);

        // Validate lesson
        var lesson = await db.Lessons
            .Include(l => l.CodeChallenges.OrderBy(c => c.SortOrder))
            .FirstOrDefaultAsync(l => l.Id == lessonId);

        if (lesson is null)
        {
            return Results.NotFound(new ErrorResponse("Lesson not found"));
        }

        if (!await EndpointHelpers.IsLessonUnlockedAsync(db, userId, lesson))
        {
            return Results.Forbid();
        }

        var challenge = lesson.CodeChallenges.ElementAtOrDefault(request.StepIndex);
        if (challenge is null)
        {
            return Results.BadRequest(new ErrorResponse("Invalid step index"));
        }

        // Static code check
        var checkResult = codeChecker.Validate(request.Code, challenge.TestCases, challenge.RequiredPackages);

        var compilationSuccess = checkResult.StructureValid;
        var compilationOutput = checkResult.StructureErrors ?? "";

        // Convert test results (skip runtime-only tests when determining pass/fail)
        var testResults = checkResult.TestResults
            .Select(t => new TestCaseResult(t.TestId, t.Name, t.Passed, t.Description))
            .ToList();

        // Only consider non-skipped tests for allPassed determination
        var applicableTests = checkResult.TestResults
            .Where(t => t.Detail is not "Skipped — requires runtime execution")
            .ToList();
        var allPassed = applicableTests.Count > 0 && applicableTests.All(t => t.Passed);

        s_logger.LogInformation("Code submit result for LessonId={LessonId}: compilation={CompilationSuccess}, allPassed={AllPassed}, tests={PassedCount}/{TotalCount}",
            lessonId, compilationSuccess, allPassed,
            testResults.Count(t => t.Passed), testResults.Count);

        // Record submission
        var submission = new CodeSubmission
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            ChallengeId = challenge.Id,
            SubmittedCode = request.Code,
            CompilationSuccess = compilationSuccess,
            CompilationOutput = compilationOutput,
            ExecutionOutput = "",
            TestResults = JsonDocument.Parse(JsonSerializer.Serialize(testResults)),
            AllPassed = allPassed,
            SubmittedAt = DateTime.UtcNow
        };
        db.CodeSubmissions.Add(submission);

        // Update progress and award XP
        var xpEarned = 0;
        var bonusXpEarned = 0;
        LevelUpInfo? levelUp = null;
        var achievements = new List<Achievement>();

        var existingProgress = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId);

        if (existingProgress is null)
        {
            existingProgress = new UserProgress
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                LessonId = lessonId,
                Status = ProgressStatuses.InProgress,
                StartedAt = DateTime.UtcNow
            };
            db.UserProgress.Add(existingProgress);
        }

        existingProgress.Attempts++;

        if (allPassed && existingProgress.Status is ProgressStatuses.NotStarted or ProgressStatuses.InProgress)
        {
            existingProgress.Status = ProgressStatuses.Completed;
            existingProgress.CompletedAt = DateTime.UtcNow;

            // Award base XP
            xpEarned = lesson.XpReward;
            var result = await gamification.AwardXpAsync(userId, xpEarned, "lesson-complete", lessonId);
            levelUp = result.LevelUp;

            // First attempt bonus
            if (existingProgress.Attempts == 1 && lesson.BonusXp > 0)
            {
                bonusXpEarned = lesson.BonusXp;
                var bonusResult = await gamification.AwardXpAsync(userId, bonusXpEarned, "challenge-first-try", lessonId);
                levelUp ??= bonusResult.LevelUp;
            }

            existingProgress.XpEarned = xpEarned + bonusXpEarned;

            await db.SaveChangesAsync();
            achievements = await gamification.CheckAchievementsAsync(userId);
        }
        else
        {
            await db.SaveChangesAsync();
        }

        return Results.Ok(new ChallengeSubmitResponse(
            CompilationSuccess: compilationSuccess,
            CompilationOutput: compilationOutput,
            ExecutionOutput: "",
            ExecutionTimeMs: null,
            TestResults: testResults,
            AllPassed: allPassed,
            XpEarned: xpEarned,
            BonusXpEarned: bonusXpEarned,
            LevelUp: levelUp,
            AchievementsUnlocked: achievements.Select(a =>
                new AchievementUnlocked(a.Id, a.Name, a.Icon, a.Rarity, a.XpReward)).ToList()));
    }

    private static async Task<bool> CheckRateLimitAsync(IConnectionMultiplexer redis, Guid userId)
    {
        var redisDb = redis.GetDatabase();
        var key = $"ratelimit:coderun:{userId}";

        var count = await redisDb.StringIncrementAsync(key);

        if (count == 1)
        {
            await redisDb.KeyExpireAsync(key, TimeSpan.FromSeconds(60));
        }

        return count <= MaxRunsPerMinute;
    }

}
