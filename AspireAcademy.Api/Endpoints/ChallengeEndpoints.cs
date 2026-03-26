using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Serialization;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using AspireAcademy.Api.Telemetry;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

namespace AspireAcademy.Api.Endpoints;

// ── Request / Response DTOs ──

public record ChallengeRunRequest(string Code, int StepIndex = 0);

public record CodeRunnerResponse(
    [property: JsonPropertyName("success")] bool Success,
    [property: JsonPropertyName("output")] string Output,
    [property: JsonPropertyName("error")] string Error);

public record ChallengeRunResponse(
    bool CompilationSuccess,
    string CompilationOutput,
    string ExecutionOutput,
    int? ExecutionTimeMs,
    string? Error);

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
        group.MapPost("/{lessonId}/submit", SubmitChallengeAsync);

        return app;
    }

    private static async Task<IResult> RunCodeAsync(
        string lessonId,
        ChallengeRunRequest request,
        AcademyDbContext db,
        IHttpClientFactory httpClientFactory,
        IConnectionMultiplexer redis,
        ClaimsPrincipal user)
    {
        var userId = GetUserId(user);
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
            return Results.NotFound(new { error = "Lesson not found" });
        }

        if (!await IsLessonUnlockedAsync(db, userId, lesson))
        {
            return Results.Forbid();
        }

        var challenge = lesson.CodeChallenges.ElementAtOrDefault(request.StepIndex);
        if (challenge is null)
        {
            return Results.BadRequest(new { error = "Invalid step index" });
        }

        // Forward to CodeRunner
        var runnerResult = await ExecuteOnCodeRunnerAsync(httpClientFactory, request.Code, challenge.RequiredPackages);

        var compilationSuccess = runnerResult is not null && string.IsNullOrEmpty(runnerResult.Error);

        return Results.Ok(new ChallengeRunResponse(
            CompilationSuccess: compilationSuccess,
            CompilationOutput: compilationSuccess ? "" : (runnerResult?.Error ?? "CodeRunner unavailable"),
            ExecutionOutput: runnerResult?.Output ?? "",
            ExecutionTimeMs: null,
            Error: runnerResult is null ? "CodeRunner service unavailable" : null));
    }

    private static async Task<IResult> SubmitChallengeAsync(
        string lessonId,
        ChallengeRunRequest request,
        AcademyDbContext db,
        IHttpClientFactory httpClientFactory,
        IConnectionMultiplexer redis,
        GamificationService gamification,
        ClaimsPrincipal user)
    {
        var userId = GetUserId(user);
        s_logger.LogInformation("Code submit for LessonId={LessonId}, UserId={UserId}", lessonId, userId);
        AcademyMetrics.ChallengesSubmitted.Add(1);

        // Validate lesson
        var lesson = await db.Lessons
            .Include(l => l.CodeChallenges.OrderBy(c => c.SortOrder))
            .FirstOrDefaultAsync(l => l.Id == lessonId);

        if (lesson is null)
        {
            return Results.NotFound(new { error = "Lesson not found" });
        }

        if (!await IsLessonUnlockedAsync(db, userId, lesson))
        {
            return Results.Forbid();
        }

        var challenge = lesson.CodeChallenges.ElementAtOrDefault(request.StepIndex);
        if (challenge is null)
        {
            return Results.BadRequest(new { error = "Invalid step index" });
        }

        // Execute code
        var runnerResult = await ExecuteOnCodeRunnerAsync(httpClientFactory, request.Code, challenge.RequiredPackages);

        var compilationSuccess = runnerResult is not null && string.IsNullOrEmpty(runnerResult.Error);
        var executionOutput = runnerResult?.Output ?? "";
        var compilationOutput = compilationSuccess ? "" : (runnerResult?.Error ?? "CodeRunner unavailable");

        // Validate against test cases
        var testResults = ValidateTestCases(challenge.TestCases, request.Code, compilationSuccess, executionOutput);
        var allPassed = testResults.Count > 0 && testResults.All(t => t.Passed);

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
            ExecutionOutput = executionOutput,
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
                Status = "in-progress",
                StartedAt = DateTime.UtcNow
            };
            db.UserProgress.Add(existingProgress);
        }

        existingProgress.Attempts++;

        if (allPassed && existingProgress.Status is "not-started" or "in-progress")
        {
            existingProgress.Status = "completed";
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
            ExecutionOutput: executionOutput,
            ExecutionTimeMs: null,
            TestResults: testResults,
            AllPassed: allPassed,
            XpEarned: xpEarned,
            BonusXpEarned: bonusXpEarned,
            LevelUp: levelUp,
            AchievementsUnlocked: achievements.Select(a =>
                new AchievementUnlocked(a.Id, a.Name, a.Icon, a.Rarity, a.XpReward)).ToList()));
    }

    private static async Task<CodeRunnerResponse?> ExecuteOnCodeRunnerAsync(
        IHttpClientFactory httpClientFactory,
        string code,
        JsonDocument requiredPackages)
    {
        AcademyMetrics.CodeRunnerExecutions.Add(1);
        using var activity = AcademyTracing.Source.StartActivity("CodeRunner.Execute");
        var sw = Stopwatch.StartNew();

        try
        {
            var client = httpClientFactory.CreateClient("coderunner");

            var packages = requiredPackages.RootElement
                .EnumerateArray()
                .Select(e => e.GetString()!)
                .ToArray();

            var url = $"{client.BaseAddress}execute";
            s_logger.LogInformation("CodeRunner HTTP call to {Url}", url);

            var payload = new { Code = code, Packages = packages, TimeoutSeconds = 30 };
            var response = await client.PostAsJsonAsync("/execute", payload);

            s_logger.LogInformation("CodeRunner response: {StatusCode}", response.StatusCode);
            activity?.SetTag("http.status_code", (int)response.StatusCode);

            if (!response.IsSuccessStatusCode)
            {
                s_logger.LogWarning("CodeRunner returned non-success status: {StatusCode}", response.StatusCode);
                activity?.SetStatus(ActivityStatusCode.Error, "Non-success status code");
                return null;
            }

            return await response.Content.ReadFromJsonAsync<CodeRunnerResponse>();
        }
        catch (Exception ex)
        {
            s_logger.LogError(ex, "CodeRunner call failed: {Message}", ex.Message);
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            return null;
        }
        finally
        {
            sw.Stop();
            AcademyMetrics.CodeRunnerDurationMs.Record(sw.Elapsed.TotalMilliseconds);
        }
    }

    private static List<TestCaseResult> ValidateTestCases(JsonDocument testCases, string code, bool compilationSuccess, string executionOutput)
    {
        var results = new List<TestCaseResult>();

        foreach (var tc in testCases.RootElement.EnumerateArray())
        {
            var testId = tc.GetProperty("id").GetString()!;
            var name = tc.GetProperty("name").GetString()!;
            var type = tc.GetProperty("type").GetString()!;
            var description = tc.GetProperty("description").GetString()!;

            var expected = tc.TryGetProperty("expected", out var exp) && exp.ValueKind != JsonValueKind.Null
                ? exp.GetString()
                : null;

            var passed = type switch
            {
                "compiles" => compilationSuccess,
                "output-equals" => compilationSuccess && executionOutput.Trim() == expected?.Trim(),
                "output-contains" => compilationSuccess && expected is not null && executionOutput.Contains(expected, StringComparison.Ordinal),
                "code-contains" => expected is not null && code.Contains(expected, StringComparison.Ordinal),
                "code-pattern" => expected is not null && System.Text.RegularExpressions.Regex.IsMatch(code, expected, System.Text.RegularExpressions.RegexOptions.None, TimeSpan.FromSeconds(1)),
                _ => false
            };

            results.Add(new TestCaseResult(testId, name, passed, description));
        }

        return results;
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

    private static async Task<bool> IsLessonUnlockedAsync(AcademyDbContext db, Guid userId, Lesson lesson)
    {
        if (lesson.UnlockAfterLessonId is null)
        {
            return true;
        }

        var prereqProgress = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lesson.UnlockAfterLessonId);

        return prereqProgress?.Status is "completed" or "perfect";
    }

    private static Guid GetUserId(ClaimsPrincipal user)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;

        if (idClaim is null || !Guid.TryParse(idClaim, out var userId))
        {
            throw new BadHttpRequestException("Invalid or missing user identity.", StatusCodes.Status401Unauthorized);
        }

        return userId;
    }
}
