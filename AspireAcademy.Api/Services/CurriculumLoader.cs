using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace AspireAcademy.Api.Services;

/// <summary>
/// Loads curriculum content from YAML/Markdown files on disk and upserts into the database.
/// Source of truth is the file system; the database is the queryable runtime store.
/// </summary>
public class CurriculumLoader
{
    private readonly AcademyDbContext _db;
    private readonly ILogger<CurriculumLoader> _logger;
    private readonly string _curriculumPath;
    private readonly IDeserializer _yaml;

    public CurriculumLoader(AcademyDbContext db, ILogger<CurriculumLoader> logger, IWebHostEnvironment env)
    {
        _db = db;
        _logger = logger;
        _curriculumPath = Path.Combine(env.ContentRootPath, "Curriculum");
        _yaml = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .Build();
    }

    public async Task LoadAsync(CancellationToken ct = default)
    {
        var worldsFile = Path.Combine(_curriculumPath, "worlds.yaml");
        if (!File.Exists(worldsFile))
        {
            _logger.LogWarning("No worlds.yaml found at {Path}, skipping curriculum load", worldsFile);
            return;
        }

        var yamlContent = await File.ReadAllTextAsync(worldsFile, ct);
        var curriculum = _yaml.Deserialize<CurriculumDefinition>(yamlContent);

        _logger.LogInformation("Loading curriculum: {WorldCount} worlds", curriculum.Worlds.Count);

        foreach (var worldDef in curriculum.Worlds)
        {
            await UpsertWorldAsync(worldDef, ct);
        }

        await LoadAchievementsAsync(ct);

        await _db.SaveChangesAsync(ct);
        _logger.LogInformation("Curriculum loaded successfully");
    }

    private async Task UpsertWorldAsync(WorldDefinition def, CancellationToken ct)
    {
        var world = await _db.Worlds.FindAsync([def.Id], ct);
        if (world is null)
        {
            world = new World { Id = def.Id };
            _db.Worlds.Add(world);
        }

        world.Name = def.Name;
        world.Description = def.Description;
        world.Icon = def.Icon;
        world.SortOrder = def.SortOrder;
        world.LevelRangeStart = def.LevelRangeStart;
        world.LevelRangeEnd = def.LevelRangeEnd;
        world.UnlockAfterWorldId = def.UnlockAfterWorld;

        foreach (var moduleDef in def.Modules)
        {
            await UpsertModuleAsync(moduleDef, def.Id, ct);
        }
    }

    private async Task UpsertModuleAsync(ModuleDefinition def, string worldId, CancellationToken ct)
    {
        var module = await _db.Modules.FindAsync([def.Id], ct);
        if (module is null)
        {
            module = new Module { Id = def.Id };
            _db.Modules.Add(module);
        }

        module.WorldId = worldId;
        module.Name = def.Name;
        module.Description = def.Description;
        module.SortOrder = def.SortOrder;
        module.UnlockAfterModuleId = def.UnlockAfterModule;

        foreach (var lessonDef in def.Lessons)
        {
            await UpsertLessonAsync(lessonDef, def.Id, ct);
        }
    }

    private async Task UpsertLessonAsync(LessonDefinition def, string moduleId, CancellationToken ct)
    {
        var lesson = await _db.Lessons.FindAsync([def.Id], ct);
        if (lesson is null)
        {
            lesson = new Lesson { Id = def.Id };
            _db.Lessons.Add(lesson);
        }

        lesson.ModuleId = moduleId;
        lesson.Title = def.Title;
        lesson.Description = def.Description;
        lesson.Type = def.Type;
        lesson.SortOrder = def.SortOrder;
        lesson.XpReward = def.XpReward;
        lesson.BonusXp = def.BonusXp;
        lesson.EstimatedMinutes = def.EstimatedMinutes;
        lesson.UnlockAfterLessonId = def.UnlockAfterLesson;
        lesson.IsBoss = def.IsBoss;

        // Load markdown content from file
        if (!string.IsNullOrEmpty(def.ContentFile))
        {
            var contentPath = Path.Combine(_curriculumPath, "content", def.ContentFile);
            if (File.Exists(contentPath))
            {
                lesson.ContentMarkdown = await File.ReadAllTextAsync(contentPath, ct);
            }
            else
            {
                _logger.LogWarning("Content file not found: {Path}", contentPath);
                lesson.ContentMarkdown = $"# {def.Title}\n\n*Content coming soon...*";
            }
        }
        else
        {
            lesson.ContentMarkdown = $"# {def.Title}\n\n*Content coming soon...*";
        }

        // Load quiz questions from YAML
        if (!string.IsNullOrEmpty(def.QuizFile))
        {
            await LoadQuizAsync(def.QuizFile, def.Id, ct);
        }

        // Load code challenge from YAML
        if (!string.IsNullOrEmpty(def.ChallengeFile))
        {
            await LoadChallengeAsync(def.ChallengeFile, def.Id, ct);
        }
    }

    private async Task LoadQuizAsync(string quizFile, string lessonId, CancellationToken ct)
    {
        var path = Path.Combine(_curriculumPath, "quizzes", quizFile);
        if (!File.Exists(path))
        {
            _logger.LogWarning("Quiz file not found: {Path}", path);
            return;
        }

        var yamlContent = await File.ReadAllTextAsync(path, ct);
        var quizDef = _yaml.Deserialize<QuizDefinition>(yamlContent);

        // Remove existing questions for this lesson
        var existing = await _db.QuizQuestions.Where(q => q.LessonId == lessonId).ToListAsync(ct);
        _db.QuizQuestions.RemoveRange(existing);

        foreach (var questionDef in quizDef.Questions)
        {
            _db.QuizQuestions.Add(new QuizQuestion
            {
                Id = Guid.NewGuid(),
                LessonId = lessonId,
                QuestionText = questionDef.Text,
                QuestionType = questionDef.Type,
                Options = JsonDocument.Parse(JsonSerializer.Serialize(questionDef.Options)),
                Explanation = questionDef.Explanation,
                CodeSnippet = questionDef.CodeSnippet,
                SortOrder = questionDef.SortOrder,
                Points = questionDef.Points,
            });
        }
    }

    private async Task LoadChallengeAsync(string challengeFile, string lessonId, CancellationToken ct)
    {
        var path = Path.Combine(_curriculumPath, "challenges", challengeFile);
        if (!File.Exists(path))
        {
            _logger.LogWarning("Challenge file not found: {Path}", path);
            return;
        }

        var yamlContent = await File.ReadAllTextAsync(path, ct);
        var challengeDef = _yaml.Deserialize<ChallengeDefinition>(yamlContent);

        // Remove existing challenge for this lesson
        var existing = await _db.CodeChallenges.Where(c => c.LessonId == lessonId).ToListAsync(ct);
        _db.CodeChallenges.RemoveRange(existing);

        _db.CodeChallenges.Add(new CodeChallenge
        {
            Id = Guid.NewGuid(),
            LessonId = lessonId,
            InstructionsMarkdown = challengeDef.Instructions,
            StarterCode = challengeDef.StarterCode,
            SolutionCode = challengeDef.SolutionCode,
            TestCases = JsonDocument.Parse(JsonSerializer.Serialize(challengeDef.TestCases)),
            Hints = JsonDocument.Parse(JsonSerializer.Serialize(challengeDef.Hints)),
            RequiredPackages = JsonDocument.Parse(JsonSerializer.Serialize(challengeDef.RequiredPackages)),
            SortOrder = challengeDef.SortOrder,
            StepTitle = challengeDef.StepTitle,
        });
    }

    private async Task LoadAchievementsAsync(CancellationToken ct)
    {
        var achievementsFile = Path.Combine(_curriculumPath, "achievements.yaml");
        if (!File.Exists(achievementsFile))
        {
            _logger.LogWarning("No achievements.yaml found at {Path}, skipping achievements load", achievementsFile);
            return;
        }

        var yamlContent = await File.ReadAllTextAsync(achievementsFile, ct);
        var achievementsDef = _yaml.Deserialize<AchievementsDefinition>(yamlContent);

        _logger.LogInformation("Loading {Count} achievements", achievementsDef.Achievements.Count);

        foreach (var def in achievementsDef.Achievements)
        {
            var achievement = await _db.Achievements.FindAsync([def.Id], ct);
            if (achievement is null)
            {
                achievement = new Achievement { Id = def.Id };
                _db.Achievements.Add(achievement);
            }

            achievement.Name = def.Name;
            achievement.Description = def.Description;
            achievement.Icon = def.Icon;
            achievement.Category = def.Category;
            achievement.TriggerType = def.TriggerType;
            achievement.TriggerConfig = JsonDocument.Parse(JsonSerializer.Serialize(def.TriggerConfig));
            achievement.XpReward = def.XpReward;
            achievement.SortOrder = def.SortOrder;
            achievement.Rarity = def.Rarity;
        }
    }
}

// YAML deserialization models

class CurriculumDefinition
{
    public List<WorldDefinition> Worlds { get; set; } = [];
}

class WorldDefinition
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Icon { get; set; } = "";
    public int SortOrder { get; set; }
    public int LevelRangeStart { get; set; }
    public int LevelRangeEnd { get; set; }
    public string? UnlockAfterWorld { get; set; }
    public List<ModuleDefinition> Modules { get; set; } = [];
}

class ModuleDefinition
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public int SortOrder { get; set; }
    public string? UnlockAfterModule { get; set; }
    public List<LessonDefinition> Lessons { get; set; } = [];
}

class LessonDefinition
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Type { get; set; } = "learn";
    public int SortOrder { get; set; }
    public int XpReward { get; set; } = 50;
    public int BonusXp { get; set; }
    public int EstimatedMinutes { get; set; } = 10;
    public string? UnlockAfterLesson { get; set; }
    public bool IsBoss { get; set; }
    public string? ContentFile { get; set; }
    public string? QuizFile { get; set; }
    public string? ChallengeFile { get; set; }
}

class QuizDefinition
{
    public List<QuizQuestionDefinition> Questions { get; set; } = [];
}

class QuizQuestionDefinition
{
    public string Text { get; set; } = "";
    public string Type { get; set; } = "multiple-choice";
    public List<object> Options { get; set; } = [];
    public string Explanation { get; set; } = "";
    public string? CodeSnippet { get; set; }
    public int SortOrder { get; set; }
    public int Points { get; set; } = 10;
}

class ChallengeDefinition
{
    public string Instructions { get; set; } = "";
    public string StarterCode { get; set; } = "";
    public string SolutionCode { get; set; } = "";
    public List<object> TestCases { get; set; } = [];
    public List<string> Hints { get; set; } = [];
    public List<string> RequiredPackages { get; set; } = [];
    public int SortOrder { get; set; }
    public string? StepTitle { get; set; }
}

class AchievementsDefinition
{
    public List<AchievementDefinition> Achievements { get; set; } = [];
}

class AchievementDefinition
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Icon { get; set; } = "";
    public string Category { get; set; } = "";
    public string TriggerType { get; set; } = "";
    public Dictionary<string, object> TriggerConfig { get; set; } = [];
    public int XpReward { get; set; }
    public string Rarity { get; set; } = "common";
    public int SortOrder { get; set; }
}
