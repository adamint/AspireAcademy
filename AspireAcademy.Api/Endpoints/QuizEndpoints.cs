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
    List<AchievementUnlocked> AchievementsUnlocked);

public record AchievementUnlocked(string Id, string Name, string Icon, string Rarity, int XpReward);

public static class QuizEndpoints
{
    private static ILogger s_logger = null!;

    public static WebApplication MapQuizEndpoints(this WebApplication app)
    {
        s_logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("QuizEndpoints");

        var group = app.MapGroup("/api/quizzes").RequireAuthorization();

        group.MapPost("/{lessonId}/submit", SubmitQuizAsync);

        return app;
    }

    private static async Task<IResult> SubmitQuizAsync(
        string lessonId,
        QuizSubmitRequest request,
        AcademyDbContext db,
        GamificationService gamification,
        ClaimsPrincipal user)
    {
        var userId = GetUserId(user);

        if (request.Answers is null or { Count: 0 })
        {
            return Results.BadRequest(new { error = "Answers are required" });
        }

        // Validate lesson exists and has quiz questions
        var lesson = await db.Lessons
            .Include(l => l.QuizQuestions.OrderBy(q => q.SortOrder))
            .FirstOrDefaultAsync(l => l.Id == lessonId);

        if (lesson is null)
        {
            return Results.NotFound(new { error = "Lesson not found" });
        }

        if (lesson.QuizQuestions.Count == 0)
        {
            return Results.BadRequest(new { error = "This lesson has no quiz questions" });
        }

        // Check if lesson is unlocked
        if (!await IsLessonUnlockedAsync(db, userId, lesson))
        {
            return Results.Forbid();
        }

        // Check if already completed with perfect score
        var existingProgress = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId);

        if (existingProgress?.Status == "perfect")
        {
            return Results.BadRequest(new { error = "Already completed with perfect score" });
        }

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

        s_logger.LogInformation("Quiz submit for LessonId={LessonId}, UserId={UserId}, score={Score}/{MaxScore}, passed={Passed}, isPerfect={IsPerfect}",
            lessonId, userId, percentage, 100, passed, isPerfect);

        AcademyMetrics.QuizzesSubmitted.Add(1);
        AcademyMetrics.QuizScorePercent.Record(
            percentage,
            new KeyValuePair<string, object?>("lessonId", lessonId),
            new KeyValuePair<string, object?>("passed", passed));

        // Update or create progress
        var xpEarned = 0;
        var bonusXpEarned = 0;
        LevelUpInfo? levelUp = null;

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
        existingProgress.Score = percentage;
        existingProgress.MaxScore = 100;

        if (passed && existingProgress.Status is "not-started" or "in-progress")
        {
            existingProgress.Status = isPerfect ? "perfect" : "completed";
            existingProgress.CompletedAt = DateTime.UtcNow;

            // Award base XP
            xpEarned = lesson.XpReward;
            var result = await gamification.AwardXpAsync(userId, xpEarned, "lesson-complete", lessonId);
            levelUp = result.LevelUp;

            // Perfect score bonus
            if (isPerfect && lesson.BonusXp > 0)
            {
                bonusXpEarned = lesson.BonusXp;
                var bonusResult = await gamification.AwardXpAsync(userId, bonusXpEarned, "quiz-perfect", lessonId);
                levelUp ??= bonusResult.LevelUp;
            }

            existingProgress.XpEarned = xpEarned + bonusXpEarned;
        }
        else if (passed && existingProgress.Status == "completed" && isPerfect)
        {
            // Upgrading from completed to perfect
            existingProgress.Status = "perfect";

            if (lesson.BonusXp > 0)
            {
                bonusXpEarned = lesson.BonusXp;
                var bonusResult = await gamification.AwardXpAsync(userId, bonusXpEarned, "quiz-perfect", lessonId);
                levelUp = bonusResult.LevelUp;
                existingProgress.XpEarned += bonusXpEarned;
            }
        }

        await db.SaveChangesAsync();

        // Check achievements
        var achievements = passed
            ? await gamification.CheckAchievementsAsync(userId)
            : [];

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
                new AchievementUnlocked(a.Id, a.Name, a.Icon, a.Rarity, a.XpReward)).ToList()));
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

            var caseSensitive = root.TryGetProperty("caseSensitive", out var cs) && cs.GetBoolean();
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
            .Where(o => o.TryGetProperty("isCorrect", out var ic) && ic.GetBoolean())
            .Select(o => o.GetProperty("id").GetString()!)
            .ToList();
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

        return Guid.Parse(idClaim!);
    }
}
