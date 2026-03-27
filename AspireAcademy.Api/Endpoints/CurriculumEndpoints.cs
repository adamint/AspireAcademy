using System.Security.Claims;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

public static class CurriculumEndpoints
{
    private const int PassingScorePercent = 70;
    private static ILogger s_logger = null!;

    public static WebApplication MapCurriculumEndpoints(this WebApplication app)
    {
        s_logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("CurriculumEndpoints");

        var group = app.MapGroup("/api").WithTags("Curriculum");

        group.MapGet("/worlds", GetWorlds).AllowAnonymous();
        group.MapGet("/worlds/{worldId}/modules", GetWorldModules).AllowAnonymous();
        group.MapGet("/modules/{moduleId}/lessons", GetModuleLessons).AllowAnonymous();
        group.MapGet("/lessons/{lessonId}", GetLessonDetail).AllowAnonymous();
        group.MapGet("/gallery", GetGallery).AllowAnonymous();
        group.MapGet("/concepts", GetConcepts).AllowAnonymous();

        return app;
    }

    private static async Task<IResult> GetWorlds(
        ClaimsPrincipal principal,
        AcademyDbContext db)
    {
        var userId = principal.Identity?.IsAuthenticated == true
            ? EndpointHelpers.GetUserId(principal)
            : (Guid?)null;

        var worlds = await db.Worlds.OrderBy(w => w.SortOrder).ToListAsync();

        s_logger.LogInformation("GET /worlds for UserId={UserId}, returning {Count} worlds", userId, worlds.Count);
        var modules = await db.Modules.ToListAsync();
        var lessons = await db.Lessons.ToListAsync();

        var userProgress = userId is not null
            ? await db.UserProgress.Where(p => p.UserId == userId).ToListAsync()
            : [];

        var completedLessonIds = userProgress
            .Where(p => EndpointHelpers.CompletedStatuses.Contains(p.Status))
            .Select(p => p.LessonId)
            .ToHashSet();

        var doneLessonIds = userProgress
            .Where(p => EndpointHelpers.DoneStatuses.Contains(p.Status))
            .Select(p => p.LessonId)
            .ToHashSet();

        var skippedLessonIds = userProgress
            .Where(p => p.Status == ProgressStatuses.Skipped)
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
            var skippedLessons = worldLessons.Count(l => skippedLessonIds.Contains(l.Id));

            var completedModuleCount = worldModules.Count(m =>
            {
                var moduleLessons = lessonsByModule.GetValueOrDefault(m.Id, []);
                return moduleLessons.Count > 0 &&
                       moduleLessons.All(l => doneLessonIds.Contains(l.Id));
            });

            // Anonymous users see all worlds as unlocked
            var isUnlocked = userId is null || IsWorldUnlocked(world, modulesByWorld, lessonsByModule, doneLessonIds);

            return new WorldDto(
                world.Id,
                world.Name,
                world.Description,
                world.Icon,
                world.SortOrder,
                world.LevelRangeStart,
                world.LevelRangeEnd,
                IsUnlocked: isUnlocked,
                ModuleCount: worldModules.Count,
                CompletedModuleCount: completedModuleCount,
                TotalLessons: totalLessons,
                CompletedLessons: completedLessons,
                SkippedLessons: skippedLessons,
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

        var userId = principal.Identity?.IsAuthenticated == true
            ? EndpointHelpers.GetUserId(principal)
            : (Guid?)null;

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

        var userProgress = userId is not null
            ? await db.UserProgress
                .Where(p => p.UserId == userId.Value && lessons.Select(l => l.Id).Contains(p.LessonId))
                .ToListAsync()
            : [];

        var completedLessonIds = userProgress
            .Where(p => EndpointHelpers.CompletedStatuses.Contains(p.Status))
            .Select(p => p.LessonId)
            .ToHashSet();

        var doneLessonIds = userProgress
            .Where(p => EndpointHelpers.DoneStatuses.Contains(p.Status))
            .Select(p => p.LessonId)
            .ToHashSet();

        var skippedLessonIds = userProgress
            .Where(p => p.Status == ProgressStatuses.Skipped)
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
            var skippedCount = moduleLessons.Count(l => skippedLessonIds.Contains(l.Id));

            // Anonymous users see all modules as unlocked
            var isUnlocked = userId is null || IsModuleUnlocked(module, lessonsByModule, doneLessonIds);

            return new ModuleDto(
                module.Id,
                module.WorldId,
                module.Name,
                module.Description,
                module.SortOrder,
                IsUnlocked: isUnlocked,
                LessonCount: lessonCount,
                CompletedLessonCount: completedCount,
                SkippedLessonCount: skippedCount,
                CompletionPercentage: lessonCount > 0
                    ? (int)Math.Round(completedCount * 100.0 / lessonCount)
                    : 0);
        }).ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> GetModuleLessons(
        string moduleId,
        ClaimsPrincipal principal,
        AcademyDbContext db,
        PersonaService personaService)
    {
        var module = await db.Modules.FindAsync(moduleId);
        if (module is null)
        {
            return Results.NotFound(new ErrorResponse("Module not found."));
        }

        var userId = principal.Identity?.IsAuthenticated == true
            ? EndpointHelpers.GetUserId(principal)
            : (Guid?)null;

        var lessons = await db.Lessons
            .Where(l => l.ModuleId == moduleId)
            .OrderBy(l => l.SortOrder)
            .ToListAsync();

        var lessonIds = lessons.Select(l => l.Id).ToList();

        var userProgress = userId is not null
            ? await db.UserProgress
                .Where(p => p.UserId == userId.Value && lessonIds.Contains(p.LessonId))
                .ToDictionaryAsync(p => p.LessonId)
            : new Dictionary<string, UserProgress>();

        var completedLessonIds = userProgress.Values
            .Where(p => EndpointHelpers.CompletedStatuses.Contains(p.Status))
            .Select(p => p.LessonId)
            .ToHashSet();

        var doneLessonIds = userProgress.Values
            .Where(p => EndpointHelpers.DoneStatuses.Contains(p.Status))
            .Select(p => p.LessonId)
            .ToHashSet();

        var result = lessons.Select(lesson =>
        {
            var progress = userProgress.GetValueOrDefault(lesson.Id);

            // Anonymous users see all lessons as unlocked
            var isUnlocked = userId is null || IsLessonUnlocked(lesson, doneLessonIds);

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
                Status: progress?.Status ?? ProgressStatuses.NotStarted,
                Score: progress?.Score,
                IsUnlocked: isUnlocked,
                PersonaRelevance: personaService.GetAllRelevance(lesson.Id, lesson.ModuleId));
        }).ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> GetLessonDetail(
        string lessonId,
        ClaimsPrincipal principal,
        AcademyDbContext db,
        PersonaService personaService)
    {
        var lesson = await db.Lessons.FirstOrDefaultAsync(l => l.Id == lessonId);
        if (lesson is null)
        {
            s_logger.LogWarning("GET /lessons/{LessonId}: lesson not found", lessonId);
            return Results.NotFound(new ErrorResponse("Lesson not found."));
        }

        var userId = principal.Identity?.IsAuthenticated == true
            ? EndpointHelpers.GetUserId(principal)
            : (Guid?)null;

        // Anonymous users see all lessons as unlocked; authenticated users check prerequisites
        bool isUnlocked;
        if (userId is null)
        {
            isUnlocked = true;
        }
        else
        {
            UserProgress? prereqProgress = null;
            if (lesson.UnlockAfterLessonId is not null)
            {
                prereqProgress = await db.UserProgress
                    .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lesson.UnlockAfterLessonId);
            }

            isUnlocked = lesson.UnlockAfterLessonId is null || prereqProgress?.Status is ProgressStatuses.Completed or ProgressStatuses.Perfect or ProgressStatuses.Skipped;
        }

        s_logger.LogInformation("GET /lessons/{LessonId} — type={LessonType}, unlocked={IsUnlocked}, userId={UserId}",
            lessonId, lesson.Type, isUnlocked, userId);

        // For locked lessons, we still return content for preview, but mark as locked
        var isLocked = !isUnlocked;

        var progress = userId is not null
            ? await db.UserProgress.FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lessonId)
            : null;

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

        var isCompleted = progress?.Status is ProgressStatuses.Completed or ProgressStatuses.Perfect;

        QuizDto? quizDto = null;
        List<ChallengeDto>? challengeSteps = null;

        if (lesson.Type is LessonTypes.Quiz or LessonTypes.BossBattle)
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

        if (lesson.Type is LessonTypes.Challenge or LessonTypes.BuildProject or LessonTypes.BossBattle)
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
            Status: progress?.Status ?? ProgressStatuses.NotStarted,
            Score: progress?.Score,
            ModuleName: module?.Name,
            WorldId: module?.WorldId,
            WorldName: world?.Name,
            IsCompleted: isCompleted,
            IsLocked: isLocked,
            PreviousLessonId: previousLesson?.Id,
            NextLessonId: nextLesson?.Id,
            PreviousLessonTitle: previousLesson?.Title,
            NextLessonTitle: nextLesson?.Title,
            PreviousLessonType: previousLesson?.Type,
            NextLessonType: nextLesson?.Type,
            Quiz: quizDto,
            ChallengeSteps: challengeSteps,
            PersonaRelevance: personaService.GetAllRelevance(lesson.Id, lesson.ModuleId)));
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

    private static readonly JsonSerializerOptions s_jsonOptions = new(JsonSerializerDefaults.Web);
    private static JsonElement? s_galleryCache;
    private static JsonElement? s_conceptsCache;

    private static IResult GetGallery(IWebHostEnvironment env)
    {
        if (s_galleryCache is null)
        {
            var path = Path.Combine(env.ContentRootPath, "Curriculum", "gallery.json");
            if (!File.Exists(path))
                return Results.Ok(Array.Empty<object>());
            var json = File.ReadAllText(path);
            s_galleryCache = JsonSerializer.Deserialize<JsonElement>(json);
        }
        return Results.Ok(s_galleryCache);
    }

    private static IResult GetConcepts(IWebHostEnvironment env)
    {
        if (s_conceptsCache is null)
        {
            var path = Path.Combine(env.ContentRootPath, "Curriculum", "concepts.json");
            if (!File.Exists(path))
                return Results.Ok(new { layerOrder = Array.Empty<string>(), layers = new { }, concepts = Array.Empty<object>() });
            var json = File.ReadAllText(path);
            s_conceptsCache = JsonSerializer.Deserialize<JsonElement>(json);
        }
        return Results.Ok(s_conceptsCache);
    }

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
    int SkippedLessons,
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
    int SkippedLessonCount,
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
    bool IsUnlocked,
    Dictionary<string, string>? PersonaRelevance = null);

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
    int SortOrder,
    string Status,
    int? Score,
    string? ModuleName,
    string? WorldId,
    string? WorldName,
    bool IsCompleted,
    bool IsLocked,
    string? PreviousLessonId,
    string? NextLessonId,
    string? PreviousLessonTitle,
    string? NextLessonTitle,
    string? PreviousLessonType,
    string? NextLessonType,
    QuizDto? Quiz,
    List<ChallengeDto>? ChallengeSteps,
    Dictionary<string, string>? PersonaRelevance = null);

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
