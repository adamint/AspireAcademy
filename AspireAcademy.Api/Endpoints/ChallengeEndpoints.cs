using System.Security.Claims;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using AspireAcademy.Api.Telemetry;
using Microsoft.EntityFrameworkCore;

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

public record ChallengeSkipResponse(
    bool Skipped,
    string LessonId,
    List<string> SolutionCodes);

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
    List<AchievementUnlocked> AchievementsUnlocked,
    int TotalXp,
    int CurrentLevel,
    string CurrentRank,
    int WeeklyXp);

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
        group.MapPost("/{lessonId}/skip", SkipChallengeAsync);

        return app;
    }

    private static async Task<IResult> RunCodeAsync(
        string lessonId,
        ChallengeRunRequest request,
        AcademyDbContext db,
        CodeCheckerService codeChecker,
        InMemoryRateLimiter rateLimiter,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);
        s_logger.LogInformation("Code run for LessonId={LessonId}, UserId={UserId}", lessonId, userId);

        // Rate limiting
        if (!rateLimiter.IsAllowed($"coderun:{userId}", MaxRunsPerMinute, TimeSpan.FromSeconds(60)))
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
        XpAwardResult? lastXpResult = null;
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
            lastXpResult = await gamification.AwardXpAsync(userId, xpEarned, "lesson-complete", lessonId);
            levelUp = lastXpResult.LevelUp;

            // First attempt bonus
            if (existingProgress.Attempts == 1 && lesson.BonusXp > 0)
            {
                bonusXpEarned = lesson.BonusXp;
                lastXpResult = await gamification.AwardXpAsync(userId, bonusXpEarned, "challenge-first-try", lessonId);
                levelUp ??= lastXpResult.LevelUp;
            }

            existingProgress.XpEarned = xpEarned + bonusXpEarned;

            await db.SaveChangesAsync();
            achievements = await gamification.CheckAchievementsAsync(userId);
        }
        else
        {
            await db.SaveChangesAsync();
        }

        // Fetch current XP stats — always re-read from DB after achievement checks
        // to include any achievement bonus XP that was awarded
        int totalXp, currentLevel, weeklyXp;
        string currentRank;
        if (lastXpResult is not null && achievements.Count > 0)
        {
            // Achievements may have awarded bonus XP — re-read from DB
            var freshXp = await db.UserXp.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId);
            totalXp = freshXp?.TotalXp ?? lastXpResult.TotalXp;
            currentLevel = freshXp?.CurrentLevel ?? lastXpResult.CurrentLevel;
            currentRank = freshXp?.CurrentRank ?? lastXpResult.CurrentRank;
            weeklyXp = freshXp?.WeeklyXp ?? lastXpResult.WeeklyXp;
        }
        else if (lastXpResult is not null)
        {
            totalXp = lastXpResult.TotalXp;
            currentLevel = lastXpResult.CurrentLevel;
            currentRank = lastXpResult.CurrentRank;
            weeklyXp = lastXpResult.WeeklyXp;
        }
        else
        {
            var userXp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId);
            totalXp = userXp?.TotalXp ?? 0;
            currentLevel = userXp?.CurrentLevel ?? 1;
            currentRank = userXp?.CurrentRank ?? Ranks.AspireIntern;
            weeklyXp = userXp?.WeeklyXp ?? 0;
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
                new AchievementUnlocked(a.Id, a.Name, a.Icon, a.Rarity, a.XpReward)).ToList(),
            TotalXp: totalXp,
            CurrentLevel: currentLevel,
            CurrentRank: currentRank,
            WeeklyXp: weeklyXp));
    }

    private static async Task<IResult> SkipChallengeAsync(
        string lessonId,
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);
        s_logger.LogInformation("Skip challenge for LessonId={LessonId}, UserId={UserId}", lessonId, userId);

        var lesson = await db.Lessons
            .Include(l => l.CodeChallenges.OrderBy(c => c.SortOrder))
            .FirstOrDefaultAsync(l => l.Id == lessonId);

        if (lesson is null)
        {
            return Results.NotFound(new ErrorResponse("Lesson not found"));
        }

        // Security: verify the lesson is unlocked before allowing skip or revealing solutions
        if (!await EndpointHelpers.IsLessonUnlockedAsync(db, userId, lesson))
        {
            return Results.Json(new ErrorResponse("Lesson is locked."), statusCode: 403);
        }

        if (lesson.CodeChallenges.Count == 0)
        {
            return Results.BadRequest(new ErrorResponse("Lesson has no challenge steps"));
        }

        var existing = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId);

        if (existing?.Status is ProgressStatuses.Completed or ProgressStatuses.Perfect)
        {
            return Results.BadRequest(new ErrorResponse("Cannot skip an already completed challenge"));
        }

        if (existing?.Status is ProgressStatuses.Skipped)
        {
            // Already skipped — return solution codes
            var solutions = lesson.CodeChallenges.Select(c => c.SolutionCode).ToList();
            return Results.Ok(new ChallengeSkipResponse(Skipped: true, LessonId: lessonId, SolutionCodes: solutions));
        }

        if (existing is null)
        {
            existing = new UserProgress
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                LessonId = lessonId,
                StartedAt = DateTime.UtcNow
            };
            db.UserProgress.Add(existing);
        }

        existing.Status = ProgressStatuses.Skipped;
        existing.XpEarned = 0;
        existing.CompletedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        var solutionCodes = lesson.CodeChallenges.Select(c => c.SolutionCode).ToList();
        return Results.Ok(new ChallengeSkipResponse(Skipped: true, LessonId: lessonId, SolutionCodes: solutionCodes));
    }

}
