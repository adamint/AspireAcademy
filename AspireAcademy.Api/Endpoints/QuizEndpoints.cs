using System.Security.Claims;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using AspireAcademy.Api.Telemetry;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

// ── Request / Response DTOs ──

public record QuizSubmitRequest(List<QuizAnswer> Answers);

public record QuizAnswer(Guid QuestionId, List<string>? SelectedOptionIds, string? FreeTextAnswer);

public record SingleAnswerRequest(Guid QuestionId, object? Answer);

public record SingleAnswerResponse(bool Correct, string Explanation, int PointsAwarded, List<string>? CorrectOptionIds);

public record QuizQuestionResult(Guid QuestionId, bool Correct, List<string>? CorrectOptionIds, string Explanation);

public record QuizSubmitResponse(
    int Score,
    int MaxScore,
    bool Passed,
    int PassingScore,
    int XpEarned,
    int BonusXpEarned,
    bool IsPerfect,
    List<QuizQuestionResult> Results,
    LevelUpInfo? LevelUp,
    List<AchievementUnlocked> AchievementsUnlocked,
    int AttemptNumber,
    int TotalXp,
    int CurrentLevel,
    string CurrentRank,
    int WeeklyXp);

public record QuizAttemptDto(
    Guid Id,
    int Score,
    int MaxScore,
    bool Passed,
    bool IsPerfect,
    int XpEarned,
    int BonusXpEarned,
    int AttemptNumber,
    DateTime CompletedAt);

public record AchievementUnlocked(string Id, string Name, string Icon, string Rarity, int XpReward);

public static class QuizEndpoints
{
    private static ILogger s_logger = null!;

    public static WebApplication MapQuizEndpoints(this WebApplication app)
    {
        s_logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("QuizEndpoints");

        var group = app.MapGroup("/api/quizzes").RequireAuthorization();

        group.MapPost("/{lessonId}/submit", SubmitQuizAsync);
        group.MapPost("/{lessonId}/answer", AnswerSingleQuestionAsync);
        group.MapGet("/{lessonId}/history", GetQuizHistoryAsync);

        return app;
    }

    /// <summary>
    /// Grades a single quiz question and returns immediate feedback.
    /// Does NOT record progress or award XP — that happens on /submit.
    /// </summary>
    private static async Task<IResult> AnswerSingleQuestionAsync(
        string lessonId,
        SingleAnswerRequest request,
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);

        // Security: verify the lesson is unlocked before grading
        var lesson = await db.Lessons.AsNoTracking().FirstOrDefaultAsync(l => l.Id == lessonId);
        if (lesson is null)
        {
            return Results.NotFound(new ErrorResponse("Lesson not found"));
        }

        if (!await EndpointHelpers.IsLessonUnlockedAsync(db, userId, lesson))
        {
            return Results.Json(new ErrorResponse("Lesson is locked."), statusCode: 403);
        }

        var question = await db.QuizQuestions
            .FirstOrDefaultAsync(q => q.Id == request.QuestionId && q.LessonId == lessonId);

        if (question is null)
        {
            return Results.NotFound(new ErrorResponse("Question not found"));
        }

        // Determine the answer based on what the frontend sends
        List<string>? selectedOptionIds = null;
        string? freeTextAnswer = null;

        if (request.Answer is string strAnswer)
        {
            // Could be an option ID or free text
            if (question.QuestionType is "fill-in-blank" or "fill_in_blank")
            {
                freeTextAnswer = strAnswer;
            }
            else
            {
                selectedOptionIds = [strAnswer];
            }
        }
        else if (request.Answer is JsonElement jsonEl)
        {
            if (jsonEl.ValueKind == JsonValueKind.String)
            {
                var val = jsonEl.GetString() ?? "";
                if (question.QuestionType is "fill-in-blank" or "fill_in_blank")
                {
                    freeTextAnswer = val;
                }
                else
                {
                    selectedOptionIds = [val];
                }
            }
            else if (jsonEl.ValueKind == JsonValueKind.Array)
            {
                selectedOptionIds = [];
                foreach (var item in jsonEl.EnumerateArray())
                {
                    selectedOptionIds.Add(item.GetString() ?? "");
                }
            }
        }

        var quizAnswer = new QuizAnswer(request.QuestionId, selectedOptionIds, freeTextAnswer);
        var (isCorrect, correctOptionIds) = GradeQuestion(question, quizAnswer);

        s_logger.LogInformation("Quiz answer for lesson {LessonId}, question {QuestionId}: correct={Correct}",
            lessonId, request.QuestionId, isCorrect);

        return Results.Ok(new SingleAnswerResponse(
            Correct: isCorrect,
            Explanation: question.Explanation,
            PointsAwarded: isCorrect ? question.Points : 0,
            CorrectOptionIds: correctOptionIds
        ));
    }

    private static async Task<IResult> SubmitQuizAsync(
        string lessonId,
        QuizSubmitRequest request,
        AcademyDbContext db,
        GamificationService gamification,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);

        if (request.Answers is null or { Count: 0 })
        {
            return Results.BadRequest(new ErrorResponse("Answers are required"));
        }

        // Validate lesson exists and has quiz questions
        var lesson = await db.Lessons
            .Include(l => l.QuizQuestions.OrderBy(q => q.SortOrder))
            .FirstOrDefaultAsync(l => l.Id == lessonId);

        if (lesson is null)
        {
            return Results.NotFound(new ErrorResponse("Lesson not found"));
        }

        if (lesson.QuizQuestions.Count == 0)
        {
            return Results.BadRequest(new ErrorResponse("This lesson has no quiz questions"));
        }

        // Check if lesson is unlocked
        if (!await EndpointHelpers.IsLessonUnlockedAsync(db, userId, lesson))
        {
            return Results.Forbid();
        }

        var existingProgress = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId);

        // Score the quiz
        var results = new List<QuizQuestionResult>();
        var totalPoints = 0;
        var earnedPoints = 0;

        foreach (var question in lesson.QuizQuestions)
        {
            totalPoints += question.Points;

            var answer = request.Answers.FirstOrDefault(a => a.QuestionId == question.Id);
            var (isCorrect, correctOptionIds) = GradeQuestion(question, answer);

            if (isCorrect)
            {
                earnedPoints += question.Points;
            }

            results.Add(new QuizQuestionResult(question.Id, isCorrect, correctOptionIds, question.Explanation));
        }

        var percentage = totalPoints > 0 ? (int)Math.Round((double)earnedPoints / totalPoints * 100) : 0;
        var passed = percentage >= 70;
        var isPerfect = percentage == 100;
        const int passingScore = 70;

        var attemptNumber = (existingProgress?.Attempts ?? 0) + 1;
        var alreadyPassed = existingProgress?.Status is ProgressStatuses.Completed or ProgressStatuses.Perfect;

        s_logger.LogInformation("Quiz submit for LessonId={LessonId}, UserId={UserId}, score={Score}/{MaxScore}, passed={Passed}, isPerfect={IsPerfect}, attempt={Attempt}",
            lessonId, userId, percentage, 100, passed, isPerfect, attemptNumber);

        AcademyMetrics.QuizzesSubmitted.Add(1);
        AcademyMetrics.QuizScorePercent.Record(
            percentage,
            new KeyValuePair<string, object?>("lessonId", lessonId),
            new KeyValuePair<string, object?>("passed", passed));

        // Update or create progress
        var xpEarned = 0;
        var bonusXpEarned = 0;
        LevelUpInfo? levelUp = null;
        XpAwardResult? lastXpResult = null;

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
        existingProgress.MaxScore = 100;

        if (passed && existingProgress.Status is ProgressStatuses.NotStarted or ProgressStatuses.InProgress)
        {
            existingProgress.Status = isPerfect ? ProgressStatuses.Perfect : ProgressStatuses.Completed;
            existingProgress.CompletedAt = DateTime.UtcNow;

            // Award base XP on first pass
            xpEarned = lesson.XpReward;
            lastXpResult = await gamification.AwardXpAsync(userId, xpEarned, "lesson-complete", lessonId);
            levelUp = lastXpResult.LevelUp;

            // Perfect score bonus
            if (isPerfect && lesson.BonusXp > 0)
            {
                bonusXpEarned = lesson.BonusXp;
                lastXpResult = await gamification.AwardXpAsync(userId, bonusXpEarned, "quiz-perfect", lessonId);
                levelUp ??= lastXpResult.LevelUp;
            }

            existingProgress.XpEarned = xpEarned + bonusXpEarned;
        }
        else if (passed && existingProgress.Status == ProgressStatuses.Completed && isPerfect)
        {
            // Upgrading from completed to perfect
            existingProgress.Status = ProgressStatuses.Perfect;

            if (lesson.BonusXp > 0)
            {
                bonusXpEarned = lesson.BonusXp;
                lastXpResult = await gamification.AwardXpAsync(userId, bonusXpEarned, "quiz-perfect", lessonId);
                levelUp = lastXpResult.LevelUp;
                existingProgress.XpEarned += bonusXpEarned;
            }
        }
        // Already perfect — retake allowed but no additional XP

        // Update best score if this attempt is higher
        if (percentage > (existingProgress.Score ?? 0))
        {
            existingProgress.Score = percentage;
        }

        // Save quiz attempt record
        var attempt = new QuizAttempt
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            LessonId = lessonId,
            Score = percentage,
            MaxScore = 100,
            Passed = passed,
            IsPerfect = isPerfect,
            XpEarned = xpEarned,
            BonusXpEarned = bonusXpEarned,
            AttemptNumber = attemptNumber,
            Results = JsonSerializer.SerializeToDocument(results),
            CompletedAt = DateTime.UtcNow
        };
        db.QuizAttempts.Add(attempt);

        await db.SaveChangesAsync();

        // Check achievements (only on first pass — not on retakes of already-passed quizzes)
        var achievements = passed && !alreadyPassed
            ? await gamification.CheckAchievementsAsync(userId)
            : [];

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

        return Results.Ok(new QuizSubmitResponse(
            Score: percentage,
            MaxScore: 100,
            Passed: passed,
            PassingScore: passingScore,
            XpEarned: xpEarned,
            BonusXpEarned: bonusXpEarned,
            IsPerfect: isPerfect,
            Results: results,
            LevelUp: levelUp,
            AchievementsUnlocked: achievements.Select(a =>
                new AchievementUnlocked(a.Id, a.Name, a.Icon, a.Rarity, a.XpReward)).ToList(),
            AttemptNumber: attemptNumber,
            TotalXp: totalXp,
            CurrentLevel: currentLevel,
            CurrentRank: currentRank,
            WeeklyXp: weeklyXp));
    }

    /// <summary>
    /// Returns the user's quiz attempt history for a lesson, ordered by most recent first.
    /// </summary>
    private static async Task<IResult> GetQuizHistoryAsync(
        string lessonId,
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);

        var attempts = await db.QuizAttempts
            .Where(a => a.UserId == userId && a.LessonId == lessonId)
            .OrderByDescending(a => a.CompletedAt)
            .Select(a => new QuizAttemptDto(
                a.Id,
                a.Score,
                a.MaxScore,
                a.Passed,
                a.IsPerfect,
                a.XpEarned,
                a.BonusXpEarned,
                a.AttemptNumber,
                a.CompletedAt))
            .ToListAsync();

        return Results.Ok(attempts);
    }

    private static (bool IsCorrect, List<string>? CorrectOptionIds) GradeQuestion(QuizQuestion question, QuizAnswer? answer)
    {
        if (answer is null)
        {
            var correctIds = GetCorrectOptionIds(question);
            return (false, correctIds);
        }

        if (question.QuestionType is "fill-in-blank")
        {
            var root = question.Options.RootElement;
            var correctAnswers = root.GetProperty("correctAnswers")
                .EnumerateArray()
                .Select(e => e.GetString()!)
                .ToList();

            var caseSensitive = root.TryGetProperty("caseSensitive", out var cs) && GetJsonBool(cs);
            var userAnswer = answer.FreeTextAnswer?.Trim() ?? "";

            var isCorrect = caseSensitive
                ? correctAnswers.Any(a => a == userAnswer)
                : correctAnswers.Any(a => string.Equals(a, userAnswer, StringComparison.OrdinalIgnoreCase));

            return (isCorrect, null);
        }

        // multiple-choice, multi-select, code-prediction
        var correctOptionIds = GetCorrectOptionIds(question);
        var selectedIds = answer.SelectedOptionIds ?? [];

        var isMatch = correctOptionIds is not null
            && selectedIds.Count == correctOptionIds.Count
            && selectedIds.Order().SequenceEqual(correctOptionIds.Order());

        return (isMatch, correctOptionIds);
    }

    private static List<string>? GetCorrectOptionIds(QuizQuestion question)
    {
        if (question.QuestionType is "fill-in-blank")
        {
            return null;
        }

        return question.Options.RootElement
            .EnumerateArray()
            .Where(o => o.TryGetProperty("isCorrect", out var ic) && GetJsonBool(ic))
            .Select(o => o.GetProperty("id").GetString()!)
            .ToList();
    }

    /// <summary>
    /// Safely reads a bool from a JsonElement that may be a boolean or a string "true"/"false".
    /// </summary>
    private static bool GetJsonBool(JsonElement element)
    {
        return element.ValueKind == JsonValueKind.True
            || (element.ValueKind == JsonValueKind.String
                && string.Equals(element.GetString(), "true", StringComparison.OrdinalIgnoreCase));
    }

}
