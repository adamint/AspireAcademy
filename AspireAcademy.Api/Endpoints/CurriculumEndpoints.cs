using System.Security.Claims;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

public static class CurriculumEndpoints
{
    private const int PassingScorePercent = 70;
    private static readonly string[] CompletedStatuses = ["completed", "perfect"];
    private static ILogger s_logger = null!;

    public static WebApplication MapCurriculumEndpoints(this WebApplication app)
    {
        s_logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("CurriculumEndpoints");

        var group = app.MapGroup("/api").WithTags("Curriculum").RequireAuthorization();

        group.MapGet("/worlds", GetWorlds);
        group.MapGet("/worlds/{worldId}/modules", GetWorldModules);
        group.MapGet("/modules/{moduleId}/lessons", GetModuleLessons);
        group.MapGet("/lessons/{lessonId}", GetLessonDetail);

        return app;
    }

    private static async Task<IResult> GetWorlds(
        ClaimsPrincipal principal,
        AcademyDbContext db)
    {
        var userId = GetUserId(principal);

        var worlds = await db.Worlds.OrderBy(w => w.SortOrder).ToListAsync();

        s_logger.LogInformation("GET /worlds for UserId={UserId}, returning {Count} worlds", userId, worlds.Count);
        var modules = await db.Modules.ToListAsync();
        var lessons = await db.Lessons.ToListAsync();
        var userProgress = await db.UserProgress
            .Where(p => p.UserId == userId)
            .ToListAsync();

        var completedLessonIds = userProgress
            .Where(p => CompletedStatuses.Contains(p.Status))
            .Select(p => p.LessonId)
            .ToHashSet();

        var modulesByWorld = modules
            .GroupBy(m => m.WorldId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var lessonsByModule = lessons
            .GroupBy(l => l.ModuleId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = worlds.Select(world =>
        {
            var worldModules = modulesByWorld.GetValueOrDefault(world.Id, []);
            var worldLessons = worldModules
                .SelectMany(m => lessonsByModule.GetValueOrDefault(m.Id, []))
                .ToList();

            var totalLessons = worldLessons.Count;
            var completedLessons = worldLessons.Count(l => completedLessonIds.Contains(l.Id));

            var completedModuleCount = worldModules.Count(m =>
            {
                var moduleLessons = lessonsByModule.GetValueOrDefault(m.Id, []);
                return moduleLessons.Count > 0 &&
                       moduleLessons.All(l => completedLessonIds.Contains(l.Id));
            });

            return new WorldDto(
                world.Id,
                world.Name,
                world.Description,
                world.Icon,
                world.SortOrder,
                world.LevelRangeStart,
                world.LevelRangeEnd,
                IsUnlocked: IsWorldUnlocked(world, modulesByWorld, lessonsByModule, completedLessonIds),
                ModuleCount: worldModules.Count,
                CompletedModuleCount: completedModuleCount,
                TotalLessons: totalLessons,
                CompletedLessons: completedLessons,
                CompletionPercentage: totalLessons > 0
                    ? (int)Math.Round(completedLessons * 100.0 / totalLessons)
                    : 0);
        }).ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> GetWorldModules(
        string worldId,
        ClaimsPrincipal principal,
        AcademyDbContext db)
    {
        var world = await db.Worlds.FindAsync(worldId);
        if (world is null)
        {
            s_logger.LogWarning("GET /worlds/{WorldId}/modules: world not found", worldId);
            return Results.NotFound(new ErrorResponse("World not found."));
        }

        var userId = GetUserId(principal);

        var modules = await db.Modules
            .Where(m => m.WorldId == worldId)
            .OrderBy(m => m.SortOrder)
            .ToListAsync();

        s_logger.LogInformation("GET /worlds/{WorldId}/modules for UserId={UserId}, returning {Count} modules",
            worldId, userId, modules.Count);

        var moduleIds = modules.Select(m => m.Id).ToList();

        var lessons = await db.Lessons
            .Where(l => moduleIds.Contains(l.ModuleId))
            .ToListAsync();

        var userProgress = await db.UserProgress
            .Where(p => p.UserId == userId && lessons.Select(l => l.Id).Contains(p.LessonId))
            .ToListAsync();

        var completedLessonIds = userProgress
            .Where(p => CompletedStatuses.Contains(p.Status))
            .Select(p => p.LessonId)
            .ToHashSet();

        var lessonsByModule = lessons
            .GroupBy(l => l.ModuleId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var result = modules.Select(module =>
        {
            var moduleLessons = lessonsByModule.GetValueOrDefault(module.Id, []);
            var lessonCount = moduleLessons.Count;
            var completedCount = moduleLessons.Count(l => completedLessonIds.Contains(l.Id));

            return new ModuleDto(
                module.Id,
                module.WorldId,
                module.Name,
                module.Description,
                module.SortOrder,
                IsUnlocked: IsModuleUnlocked(module, lessonsByModule, completedLessonIds),
                LessonCount: lessonCount,
                CompletedLessonCount: completedCount,
                CompletionPercentage: lessonCount > 0
                    ? (int)Math.Round(completedCount * 100.0 / lessonCount)
                    : 0);
        }).ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> GetModuleLessons(
        string moduleId,
        ClaimsPrincipal principal,
        AcademyDbContext db)
    {
        var module = await db.Modules.FindAsync(moduleId);
        if (module is null)
        {
            return Results.NotFound(new ErrorResponse("Module not found."));
        }

        var userId = GetUserId(principal);

        var lessons = await db.Lessons
            .Where(l => l.ModuleId == moduleId)
            .OrderBy(l => l.SortOrder)
            .ToListAsync();

        var lessonIds = lessons.Select(l => l.Id).ToList();

        var userProgress = await db.UserProgress
            .Where(p => p.UserId == userId && lessonIds.Contains(p.LessonId))
            .ToDictionaryAsync(p => p.LessonId);

        var completedLessonIds = userProgress.Values
            .Where(p => CompletedStatuses.Contains(p.Status))
            .Select(p => p.LessonId)
            .ToHashSet();

        var result = lessons.Select(lesson =>
        {
            var progress = userProgress.GetValueOrDefault(lesson.Id);

            return new LessonListDto(
                lesson.Id,
                lesson.ModuleId,
                lesson.Title,
                lesson.Description,
                lesson.Type,
                lesson.SortOrder,
                lesson.XpReward,
                lesson.BonusXp,
                lesson.EstimatedMinutes,
                lesson.IsBoss,
                Status: progress?.Status ?? "not-started",
                Score: progress?.Score,
                IsUnlocked: IsLessonUnlocked(lesson, completedLessonIds));
        }).ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> GetLessonDetail(
        string lessonId,
        ClaimsPrincipal principal,
        AcademyDbContext db)
    {
        var lesson = await db.Lessons.FirstOrDefaultAsync(l => l.Id == lessonId);
        if (lesson is null)
        {
            s_logger.LogWarning("GET /lessons/{LessonId}: lesson not found", lessonId);
            return Results.NotFound(new ErrorResponse("Lesson not found."));
        }

        var userId = GetUserId(principal);

        // Check if lesson is unlocked before returning content
        UserProgress? prereqProgress = null;
        if (lesson.UnlockAfterLessonId is not null)
        {
            prereqProgress = await db.UserProgress
                .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lesson.UnlockAfterLessonId);
        }

        var isUnlocked = lesson.UnlockAfterLessonId is null || prereqProgress?.Status is "completed" or "perfect";
        s_logger.LogInformation("GET /lessons/{LessonId} — type={LessonType}, unlocked={IsUnlocked}, userId={UserId}",
            lessonId, lesson.Type, isUnlocked, userId);

        if (!isUnlocked)
        {
            return Results.Json(new ErrorResponse("Lesson is locked."), statusCode: 403);
        }

        var progress = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId);

        // Fetch module and world for navigation context
        var module = await db.Modules.FirstOrDefaultAsync(m => m.Id == lesson.ModuleId);
        var world = module is not null
            ? await db.Worlds.FirstOrDefaultAsync(w => w.Id == module.WorldId)
            : null;

        // Find previous/next lessons in the same module by sort order
        var siblingLessons = await db.Lessons
            .Where(l => l.ModuleId == lesson.ModuleId)
            .OrderBy(l => l.SortOrder)
            .Select(l => new { l.Id, l.Title, l.Type, l.SortOrder })
            .ToListAsync();

        var currentIndex = siblingLessons.FindIndex(l => l.Id == lessonId);
        var previousLesson = currentIndex > 0 ? siblingLessons[currentIndex - 1] : null;
        var nextLesson = currentIndex >= 0 && currentIndex < siblingLessons.Count - 1
            ? siblingLessons[currentIndex + 1]
            : null;

        var isCompleted = progress?.Status is "completed" or "perfect";

        QuizDto? quizDto = null;
        List<ChallengeDto>? challengeSteps = null;

        if (lesson.Type is "quiz" or "boss-battle")
        {
            var questions = await db.QuizQuestions
                .Where(q => q.LessonId == lessonId)
                .ToListAsync();

            if (questions.Count > 0)
            {
                var questionDtos = questions.Select(q => new QuizQuestionDto(
                    q.Id,
                    q.QuestionText,
                    q.QuestionType,
                    q.Options.RootElement.EnumerateArray()
                        .Select(o => new QuizOptionDto(
                            o.GetProperty("id").GetString()!,
                            o.GetProperty("text").GetString()!))
                        .ToList(),
                    q.CodeSnippet,
                    q.Points)).ToList();

                quizDto = new QuizDto(
                    questionDtos,
                    TotalPoints: questions.Sum(q => q.Points),
                    PassingScorePercent);
            }
        }

        if (lesson.Type is "challenge" or "build-project" or "boss-battle")
        {
            var challenges = await db.CodeChallenges
                .Where(c => c.LessonId == lessonId)
                .OrderBy(c => c.SortOrder)
                .ToListAsync();

            if (challenges.Count > 0)
            {
                challengeSteps = challenges.Select(challenge => new ChallengeDto(
                    challenge.Id,
                    challenge.InstructionsMarkdown,
                    challenge.StarterCode,
                    challenge.Hints.Deserialize<List<string>>() ?? [],
                    challenge.TestCases.RootElement.Clone(),
                    challenge.RequiredPackages.Deserialize<List<string>>() ?? [],
                    challenge.StepTitle)).ToList();
            }
        }

        return Results.Ok(new LessonDetailDto(
            lesson.Id,
            lesson.ModuleId,
            lesson.Title,
            lesson.Description,
            lesson.Type,
            lesson.ContentMarkdown,
            lesson.XpReward,
            lesson.BonusXp,
            lesson.EstimatedMinutes,
            lesson.IsBoss,
            lesson.SortOrder,
            Status: progress?.Status ?? "not-started",
            Score: progress?.Score,
            ModuleName: module?.Name,
            WorldId: module?.WorldId,
            WorldName: world?.Name,
            IsCompleted: isCompleted,
            PreviousLessonId: previousLesson?.Id,
            NextLessonId: nextLesson?.Id,
            PreviousLessonTitle: previousLesson?.Title,
            NextLessonTitle: nextLesson?.Title,
            PreviousLessonType: previousLesson?.Type,
            NextLessonType: nextLesson?.Type,
            quizDto,
            challengeSteps));
    }

    // --- Unlock Logic ---

    private static bool IsWorldUnlocked(
        World world,
        Dictionary<string, List<Module>> modulesByWorld,
        Dictionary<string, List<Lesson>> lessonsByModule,
        HashSet<string> completedLessonIds)
    {
        if (world.UnlockAfterWorldId is null)
        {
            return true;
        }

        if (!modulesByWorld.TryGetValue(world.UnlockAfterWorldId, out var prereqModules))
        {
            return false;
        }

        return prereqModules.All(m =>
        {
            var lessons = lessonsByModule.GetValueOrDefault(m.Id, []);
            return lessons.Count > 0 && lessons.All(l => completedLessonIds.Contains(l.Id));
        });
    }

    private static bool IsModuleUnlocked(
        Module module,
        Dictionary<string, List<Lesson>> lessonsByModule,
        HashSet<string> completedLessonIds)
    {
        if (module.UnlockAfterModuleId is null)
        {
            return true;
        }

        if (!lessonsByModule.TryGetValue(module.UnlockAfterModuleId, out var prereqLessons))
        {
            return false;
        }

        return prereqLessons.All(l => completedLessonIds.Contains(l.Id));
    }

    private static bool IsLessonUnlocked(
        Lesson lesson,
        HashSet<string> completedLessonIds)
    {
        return lesson.UnlockAfterLessonId is null ||
               completedLessonIds.Contains(lesson.UnlockAfterLessonId);
    }

    private static Guid GetUserId(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
}

// --- DTOs ---

public record WorldDto(
    string Id,
    string Name,
    string Description,
    string Icon,
    int SortOrder,
    int LevelRangeStart,
    int LevelRangeEnd,
    bool IsUnlocked,
    int ModuleCount,
    int CompletedModuleCount,
    int TotalLessons,
    int CompletedLessons,
    int CompletionPercentage);

public record ModuleDto(
    string Id,
    string WorldId,
    string Name,
    string Description,
    int SortOrder,
    bool IsUnlocked,
    int LessonCount,
    int CompletedLessonCount,
    int CompletionPercentage);

public record LessonListDto(
    string Id,
    string ModuleId,
    string Title,
    string Description,
    string Type,
    int SortOrder,
    int XpReward,
    int BonusXp,
    int EstimatedMinutes,
    bool IsBoss,
    string Status,
    int? Score,
    bool IsUnlocked);

public record LessonDetailDto(
    string Id,
    string ModuleId,
    string Title,
    string Description,
    string Type,
    string? ContentMarkdown,
    int XpReward,
    int BonusXp,
    int EstimatedMinutes,
    bool IsBoss,
    string Status,
    int? Score,
    QuizDto? Quiz,
    List<ChallengeDto>? ChallengeSteps);

public record QuizDto(
    List<QuizQuestionDto> Questions,
    int TotalPoints,
    int PassingScore);

public record QuizQuestionDto(
    Guid Id,
    string QuestionText,
    string QuestionType,
    List<QuizOptionDto> Options,
    string? CodeSnippet,
    int Points);

public record QuizOptionDto(string Id, string Text);

public record ChallengeDto(
    Guid Id,
    string InstructionsMarkdown,
    string StarterCode,
    List<string> Hints,
    JsonElement TestCases,
    List<string> RequiredPackages,
    string? StepTitle);
