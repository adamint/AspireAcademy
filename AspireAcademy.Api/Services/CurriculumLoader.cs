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
    private readonly IDeserializer _quizYaml;

    public CurriculumLoader(AcademyDbContext db, ILogger<CurriculumLoader> logger, IWebHostEnvironment env)
    {
        _db = db;
        _logger = logger;
        _curriculumPath = Path.Combine(env.ContentRootPath, "Curriculum");
        _yaml = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .Build();
        // Quiz files use mixed naming (camelCase and snake_case), so use underscore convention with ignore unmatched
        _quizYaml = new DeserializerBuilder()
            .WithNamingConvention(UnderscoredNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();
        _logger.LogInformation("CurriculumLoader initialized, curriculumPath={CurriculumPath}", _curriculumPath);
    }

    public async Task LoadAsync(CancellationToken ct = default)
    {
        var worldsFile = Path.Combine(_curriculumPath, "worlds.yaml");
        _logger.LogInformation("Looking for worlds.yaml at {Path}", worldsFile);

        if (!File.Exists(worldsFile))
        {
            _logger.LogWarning("No worlds.yaml found at {Path}, skipping curriculum load", worldsFile);
            return;
        }

        _logger.LogInformation("Reading worlds.yaml...");
        var yamlContent = await File.ReadAllTextAsync(worldsFile, ct);
        _logger.LogInformation("Read {Length} chars from worlds.yaml. First 200 chars: {Preview}",
            yamlContent.Length, yamlContent[..Math.Min(200, yamlContent.Length)]);

        CurriculumDefinition? curriculum;
        try
        {
            curriculum = _yaml.Deserialize<CurriculumDefinition>(yamlContent);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "YAML deserialization failed for worlds.yaml");
            throw;
        }

        if (curriculum is null)
        {
            _logger.LogError("YAML deserialization returned null for worlds.yaml — check file format");
            return;
        }

        if (curriculum.Worlds is null || curriculum.Worlds.Count == 0)
        {
            _logger.LogWarning("Deserialized curriculum contains 0 worlds — YAML may have wrong structure. Expected root key 'worlds:'");
            return;
        }

        var totalModules = curriculum.Worlds.Sum(w => w.Modules.Count);
        var totalLessons = curriculum.Worlds.Sum(w => w.Modules.Sum(m => m.Lessons.Count));
        _logger.LogInformation(
            "Parsed from YAML: {WorldCount} worlds, {ModuleCount} modules, {LessonCount} lessons",
            curriculum.Worlds.Count, totalModules, totalLessons);

        foreach (var worldDef in curriculum.Worlds)
        {
            try
            {
                await UpsertWorldAsync(worldDef, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upsert world {WorldId} ({WorldName})", worldDef.Id, worldDef.Name);
                throw;
            }
        }

        await LoadAchievementsAsync(ct);

        _logger.LogInformation("Calling SaveChangesAsync...");
        var saved = await _db.SaveChangesAsync(ct);
        _logger.LogInformation("SaveChangesAsync completed, {SavedCount} entities written", saved);

        var worldCount = await _db.Worlds.CountAsync(ct);
        var moduleCount = await _db.Modules.CountAsync(ct);
        var lessonCount = await _db.Lessons.CountAsync(ct);
        var quizCount = await _db.QuizQuestions.CountAsync(ct);
        var challengeCount = await _db.CodeChallenges.CountAsync(ct);
        var achievementCount = await _db.Achievements.CountAsync(ct);
        _logger.LogInformation(
            "Database now contains: {Worlds} worlds, {Modules} modules, {Lessons} lessons, {Quizzes} quiz questions, {Challenges} challenges, {Achievements} achievements",
            worldCount, moduleCount, lessonCount, quizCount, challengeCount, achievementCount);
    }

    private async Task UpsertWorldAsync(WorldDefinition def, CancellationToken ct)
    {
        _logger.LogDebug("Upserting world {WorldId} ({WorldName}) with {ModuleCount} modules",
            def.Id, def.Name, def.Modules.Count);

        var world = await _db.Worlds.FindAsync([def.Id], ct);
        if (world is null)
        {
            world = new World { Id = def.Id };
            _db.Worlds.Add(world);
            _logger.LogDebug("Creating new world {WorldId}", def.Id);
        }
        else
        {
            _logger.LogDebug("Updating existing world {WorldId}", def.Id);
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
        _logger.LogDebug("Upserting module {ModuleId} ({ModuleName}) in world {WorldId} with {LessonCount} lessons",
            def.Id, def.Name, worldId, def.Lessons.Count);

        var module = await _db.Modules.FindAsync([def.Id], ct);
        if (module is null)
        {
            module = new Module { Id = def.Id };
            _db.Modules.Add(module);
            _logger.LogDebug("Creating new module {ModuleId}", def.Id);
        }
        else
        {
            _logger.LogDebug("Updating existing module {ModuleId}", def.Id);
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
        _logger.LogDebug("Upserting lesson {LessonId} ({LessonTitle}) type={LessonType} in module {ModuleId}",
            def.Id, def.Title, def.Type, moduleId);

        var lesson = await _db.Lessons.FindAsync([def.Id], ct);
        if (lesson is null)
        {
            lesson = new Lesson { Id = def.Id };
            _db.Lessons.Add(lesson);
            _logger.LogDebug("Creating new lesson {LessonId}", def.Id);
        }
        else
        {
            _logger.LogDebug("Updating existing lesson {LessonId}", def.Id);
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
                _logger.LogDebug("Loaded content file {Path} ({Length} chars)", contentPath, lesson.ContentMarkdown.Length);
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
        _logger.LogDebug("Loading quiz from {Path} for lesson {LessonId}", path, lessonId);

        if (!File.Exists(path))
        {
            _logger.LogWarning("Quiz file not found: {Path}", path);
            return;
        }

        var yamlContent = await File.ReadAllTextAsync(path, ct);

        QuizDefinition? quizDef;
        try
        {
            quizDef = _yaml.Deserialize<QuizDefinition>(yamlContent);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "camelCase deserialization failed for quiz {Path}, trying underscore convention", path);
            try
            {
                quizDef = _quizYaml.Deserialize<QuizDefinition>(yamlContent);
            }
            catch (Exception ex2)
            {
                _logger.LogError(ex2, "YAML deserialization failed for quiz file {Path} with both naming conventions", path);
                throw;
            }
        }

        if (quizDef?.Questions is null || quizDef.Questions.Count == 0)
        {
            _logger.LogWarning("Quiz file {Path} deserialized to 0 questions", path);
            return;
        }

        // Remove existing questions for this lesson
        var existing = await _db.QuizQuestions.Where(q => q.LessonId == lessonId).ToListAsync(ct);
        _db.QuizQuestions.RemoveRange(existing);

        foreach (var questionDef in quizDef.Questions)
        {
            // Normalize options: handle correctOptionId, correctAnswer, and isCorrect formats
            var normalizedOptions = NormalizeQuizOptions(questionDef.Options, questionDef.CorrectOptionId, questionDef.CorrectAnswer);

            _db.QuizQuestions.Add(new QuizQuestion
            {
                Id = Guid.NewGuid(),
                LessonId = lessonId,
                QuestionText = questionDef.EffectiveText,
                QuestionType = questionDef.Type.Replace('_', '-'),
                Options = JsonDocument.Parse(JsonSerializer.Serialize(normalizedOptions)),
                Explanation = questionDef.Explanation,
                CodeSnippet = questionDef.CodeSnippet,
                SortOrder = questionDef.SortOrder,
                Points = questionDef.Points,
            });
        }

        _logger.LogDebug("Loaded {Count} quiz questions for lesson {LessonId}", quizDef.Questions.Count, lessonId);
    }

    /// <summary>
    /// Normalizes quiz options to a consistent format with id, text, and isCorrect.
    /// Handles three YAML formats:
    /// 1. Options with isCorrect already set (standard format)
    /// 2. Options with correctOptionId (boss battles format 1)
    /// 3. Plain string options with correctAnswer index (boss battles format 2)
    /// </summary>
    private static List<object> NormalizeQuizOptions(List<object> options, string? correctOptionId, string? correctAnswer)
    {
        // Format 3: plain string options with correctAnswer as index or text
        if (options.Count > 0 && options[0] is string)
        {
            var normalized = new List<object>();
            for (var i = 0; i < options.Count; i++)
            {
                var text = options[i].ToString()!;
                var optId = ((char)('a' + i)).ToString();

                var isCorrect = false;
                if (correctAnswer is not null)
                {
                    // correctAnswer can be an index (0-based) or the text itself
                    if (int.TryParse(correctAnswer, out var idx))
                    {
                        isCorrect = i == idx;
                    }
                    else
                    {
                        isCorrect = string.Equals(text, correctAnswer, StringComparison.OrdinalIgnoreCase);
                    }
                }

                normalized.Add(new Dictionary<string, object>
                {
                    ["id"] = optId,
                    ["text"] = text,
                    ["isCorrect"] = isCorrect
                });
            }

            return normalized;
        }

        // Format 2: dictionary options with correctOptionId
        if (correctOptionId is not null)
        {
            var normalized = new List<object>();
            foreach (var opt in options)
            {
                if (opt is Dictionary<object, object> dict)
                {
                    var newDict = new Dictionary<string, object>();
                    foreach (var kvp in dict)
                    {
                        newDict[kvp.Key.ToString()!] = kvp.Value;
                    }

                    var optId = newDict.GetValueOrDefault("id")?.ToString();
                    newDict["isCorrect"] = string.Equals(optId, correctOptionId, StringComparison.OrdinalIgnoreCase);
                    normalized.Add(newDict);
                }
                else
                {
                    normalized.Add(opt);
                }
            }

            return normalized;
        }

        // Format 1: options already have isCorrect — pass through
        return options;
    }

    private async Task LoadChallengeAsync(string challengeFile, string lessonId, CancellationToken ct)
    {
        var path = Path.Combine(_curriculumPath, "challenges", challengeFile);
        _logger.LogDebug("Loading challenge from {Path} for lesson {LessonId}", path, lessonId);

        if (!File.Exists(path))
        {
            _logger.LogWarning("Challenge file not found: {Path}", path);
            return;
        }

        var yamlContent = await File.ReadAllTextAsync(path, ct);

        ChallengeDefinition? challengeDef;
        try
        {
            challengeDef = _yaml.Deserialize<ChallengeDefinition>(yamlContent);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "YAML deserialization failed for challenge file {Path}", path);
            throw;
        }

        if (challengeDef is null)
        {
            _logger.LogWarning("Challenge file {Path} deserialized to null", path);
            return;
        }

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

        _logger.LogDebug("Loaded challenge for lesson {LessonId} with {TestCount} test cases",
            lessonId, challengeDef.TestCases.Count);
    }

    private async Task LoadAchievementsAsync(CancellationToken ct)
    {
        var achievementsFile = Path.Combine(_curriculumPath, "achievements.yaml");
        _logger.LogInformation("Looking for achievements.yaml at {Path}", achievementsFile);

        if (!File.Exists(achievementsFile))
        {
            _logger.LogWarning("No achievements.yaml found at {Path}, skipping achievements load", achievementsFile);
            return;
        }

        var yamlContent = await File.ReadAllTextAsync(achievementsFile, ct);
        _logger.LogDebug("Read {Length} chars from achievements.yaml", yamlContent.Length);

        AchievementsDefinition? achievementsDef;
        try
        {
            achievementsDef = _yaml.Deserialize<AchievementsDefinition>(yamlContent);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "YAML deserialization failed for achievements.yaml");
            throw;
        }

        if (achievementsDef?.Achievements is null || achievementsDef.Achievements.Count == 0)
        {
            _logger.LogWarning("achievements.yaml deserialized to 0 achievements");
            return;
        }

        _logger.LogInformation("Loading {Count} achievements", achievementsDef.Achievements.Count);

        foreach (var def in achievementsDef.Achievements)
        {
            var achievement = await _db.Achievements.FindAsync([def.Id], ct);
            if (achievement is null)
            {
                achievement = new Achievement { Id = def.Id };
                _db.Achievements.Add(achievement);
                _logger.LogDebug("Creating achievement {AchievementId} ({AchievementName})", def.Id, def.Name);
            }
            else
            {
                _logger.LogDebug("Updating achievement {AchievementId}", def.Id);
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
    public string? Title { get; set; }
    public string? Module { get; set; }
    public string? Description { get; set; }
    public int? PassingScore { get; set; }
    public List<QuizQuestionDefinition> Questions { get; set; } = [];
}

class QuizQuestionDefinition
{
    public string? Id { get; set; }
    public string Text { get; set; } = "";
    public string Question { get; set; } = "";
    public string Type { get; set; } = "multiple-choice";
    public List<object> Options { get; set; } = [];
    public string? CorrectOptionId { get; set; }
    public string? CorrectAnswer { get; set; }
    public string Explanation { get; set; } = "";
    public string? CodeSnippet { get; set; }
    public int SortOrder { get; set; }
    public int Points { get; set; } = 10;

    /// <summary>
    /// Gets the question text from whichever field is populated.
    /// </summary>
    public string EffectiveText => !string.IsNullOrEmpty(Text) ? Text : Question;
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
