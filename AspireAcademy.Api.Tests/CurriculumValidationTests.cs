using System.Text.Json;
using FluentAssertions;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace AspireAcademy.Api.Tests;

/// <summary>
/// Validates the on-disk YAML curriculum files for structural correctness,
/// ensuring deserialization works and all cross-file references resolve.
/// </summary>
public class CurriculumValidationTests
{
    private static readonly string CurriculumPath = FindCurriculumPath();
    private static readonly IDeserializer YamlDeserializer = new DeserializerBuilder()
        .WithNamingConvention(CamelCaseNamingConvention.Instance)
        .IgnoreUnmatchedProperties()
        .Build();

    private static string FindCurriculumPath()
    {
        // Walk up from the test assembly output directory to find the API project
        var dir = AppContext.BaseDirectory;
        while (dir is not null)
        {
            var candidate = Path.Combine(dir, "AspireAcademy.Api", "Curriculum");
            if (Directory.Exists(candidate))
            {
                return candidate;
            }

            dir = Directory.GetParent(dir)?.FullName;
        }

        // Fallback: repository-relative path
        var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", ".."));
        return Path.Combine(repoRoot, "AspireAcademy.Api", "Curriculum");
    }

    // ── worlds.yaml validation ──

    [Fact]
    public void WorldsYaml_FileExists()
    {
        var path = Path.Combine(CurriculumPath, "worlds.yaml");
        File.Exists(path).Should().BeTrue($"worlds.yaml should exist at {path}");
    }

    [Fact]
    public void WorldsYaml_DeserializesWithoutErrors()
    {
        var root = LoadWorldsRoot();
        root.Should().NotBeNull();
        root.Worlds.Should().NotBeNull();
    }

    [Fact]
    public void WorldsYaml_HasExactly13Worlds()
    {
        var root = LoadWorldsRoot();
        root.Worlds.Should().HaveCount(13);
    }

    [Fact]
    public void WorldsYaml_EachWorldHasRequiredFields()
    {
        var root = LoadWorldsRoot();

        foreach (var world in root.Worlds)
        {
            world.Id.Should().NotBeNullOrEmpty($"world must have an id");
            world.Name.Should().NotBeNullOrEmpty($"world '{world.Id}' must have a name");
            world.Description.Should().NotBeNullOrEmpty($"world '{world.Id}' must have a description");
            world.Icon.Should().NotBeNullOrEmpty($"world '{world.Id}' must have an icon");
            world.SortOrder.Should().BeGreaterThan(0, $"world '{world.Id}' must have a positive sortOrder");
            world.Modules.Should().NotBeNull($"world '{world.Id}' must have a modules array");
            world.Modules.Should().NotBeEmpty($"world '{world.Id}' must have at least one module");
        }
    }

    [Fact]
    public void WorldsYaml_EachModuleHasRequiredFieldsAndMatchesParent()
    {
        var root = LoadWorldsRoot();

        foreach (var world in root.Worlds)
        {
            foreach (var module in world.Modules)
            {
                module.Id.Should().NotBeNullOrEmpty($"module in world '{world.Id}' must have an id");
                module.Name.Should().NotBeNullOrEmpty($"module '{module.Id}' must have a name");
                module.SortOrder.Should().BeGreaterThan(0, $"module '{module.Id}' must have a positive sortOrder");
                module.Lessons.Should().NotBeNull($"module '{module.Id}' must have a lessons array");
                module.Lessons.Should().NotBeEmpty($"module '{module.Id}' must have at least one lesson");

                // Verify the module ID prefix matches the world it belongs to
                // e.g., module "1.2" belongs to "world-1"
                var worldNumber = world.Id.Replace("world-", "");
                module.Id.Should().StartWith($"{worldNumber}.",
                    $"module '{module.Id}' should have an ID prefixed with '{worldNumber}.' for world '{world.Id}'");
            }
        }
    }

    [Fact]
    public void WorldsYaml_EachLessonHasRequiredFields()
    {
        var validTypes = new[] { "learn", "quiz", "challenge", "build-project", "boss-battle" };
        var root = LoadWorldsRoot();

        foreach (var world in root.Worlds)
        {
            foreach (var module in world.Modules)
            {
                foreach (var lesson in module.Lessons)
                {
                    lesson.Id.Should().NotBeNullOrEmpty($"lesson in module '{module.Id}' must have an id");
                    lesson.Title.Should().NotBeNullOrEmpty($"lesson '{lesson.Id}' must have a title");
                    lesson.Type.Should().NotBeNullOrEmpty($"lesson '{lesson.Id}' must have a type");
                    validTypes.Should().Contain(lesson.Type,
                        $"lesson '{lesson.Id}' has invalid type '{lesson.Type}'");
                    lesson.XpReward.Should().BeGreaterThan(0,
                        $"lesson '{lesson.Id}' must have xpReward > 0");
                }
            }
        }
    }

    [Fact]
    public void WorldsYaml_NoDuplicateIds()
    {
        var root = LoadWorldsRoot();

        var worldIds = root.Worlds.Select(w => w.Id).ToList();
        worldIds.Should().OnlyHaveUniqueItems("world IDs must be unique");

        var moduleIds = root.Worlds.SelectMany(w => w.Modules).Select(m => m.Id).ToList();
        moduleIds.Should().OnlyHaveUniqueItems("module IDs must be unique");

        var lessonIds = root.Worlds
            .SelectMany(w => w.Modules)
            .SelectMany(m => m.Lessons)
            .Select(l => l.Id)
            .ToList();
        lessonIds.Should().OnlyHaveUniqueItems("lesson IDs must be unique");

        // Verify no collisions across entity types
        var allIds = worldIds.Concat(moduleIds).Concat(lessonIds).ToList();
        allIds.Should().OnlyHaveUniqueItems("IDs must be unique across worlds, modules, and lessons");
    }

    // ── Quiz YAML validation ──

    [Fact]
    public void QuizYaml_AllFilesDeserialize()
    {
        var quizDir = Path.Combine(CurriculumPath, "quizzes");
        Directory.Exists(quizDir).Should().BeTrue("quizzes directory must exist");

        var quizFiles = Directory.GetFiles(quizDir, "*.yaml");
        quizFiles.Should().NotBeEmpty("there should be at least one quiz file");

        foreach (var file in quizFiles)
        {
            var yaml = File.ReadAllText(file);
            var quiz = YamlDeserializer.Deserialize<QuizYamlRoot>(yaml);
            quiz.Should().NotBeNull($"quiz file {Path.GetFileName(file)} must deserialize");
            quiz!.Questions.Should().NotBeNullOrEmpty(
                $"quiz file {Path.GetFileName(file)} must have at least one question");
        }
    }

    [Fact]
    public void QuizYaml_QuestionsHaveRequiredFields()
    {
        var validTypes = new[] { "multiple-choice", "code-prediction", "fill-in-blank", "multi-select", "multiple_choice", "code_prediction", "fill_in_blank", "multi_select" };
        var quizDir = Path.Combine(CurriculumPath, "quizzes");
        var quizFiles = Directory.GetFiles(quizDir, "*.yaml");

        foreach (var file in quizFiles)
        {
            var fileName = Path.GetFileName(file);
            var yaml = File.ReadAllText(file);
            var quiz = YamlDeserializer.Deserialize<QuizYamlRoot>(yaml);

            foreach (var q in quiz!.Questions)
            {
                var questionText = q.Text ?? q.Question;
                questionText.Should().NotBeNullOrEmpty(
                    $"question in {fileName} must have text or question field");
                // Type may come from 'type' field or default; some boss quizzes omit it (defaults to multiple-choice)
                if (!string.IsNullOrEmpty(q.Type))
                {
                    validTypes.Should().Contain(q.Type,
                        $"question in {fileName} has invalid type '{q.Type}'");
                }
                q.Options.Should().NotBeNullOrEmpty(
                    $"question in {fileName} must have a non-empty options array");
                q.Explanation.Should().NotBeNullOrEmpty(
                    $"question in {fileName} must have an explanation");
            }
        }
    }

    [Fact]
    public void QuizYaml_EachOptionHasIdAndText()
    {
        var quizDir = Path.Combine(CurriculumPath, "quizzes");
        var quizFiles = Directory.GetFiles(quizDir, "*.yaml");

        foreach (var file in quizFiles)
        {
            var fileName = Path.GetFileName(file);
            var yaml = File.ReadAllText(file);
            var quiz = YamlDeserializer.Deserialize<QuizYamlRoot>(yaml);

            foreach (var q in quiz!.Questions)
            {
                foreach (var opt in q.Options)
                {
                    if (opt is Dictionary<object, object> dict)
                    {
                        dict.Should().ContainKey("id",
                            $"option in {fileName} must have an 'id'");
                        dict.Should().ContainKey("text",
                            $"option in {fileName} must have 'text'");
                        // isCorrect may be absent when correctOptionId is used at question level
                        if (string.IsNullOrEmpty(q.CorrectOptionId))
                        {
                            dict.Should().ContainKey("isCorrect",
                                $"option in {fileName} must have 'isCorrect' when no correctOptionId is set");
                        }
                    }
                    // String options are also valid (Format 3: plain strings with correctAnswer)
                }
            }
        }
    }

    [Fact]
    public void QuizYaml_AtLeastOneCorrectOptionPerQuestion()
    {
        var quizDir = Path.Combine(CurriculumPath, "quizzes");
        var quizFiles = Directory.GetFiles(quizDir, "*.yaml");

        var underscoreDeserializer = new DeserializerBuilder()
            .WithNamingConvention(UnderscoredNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();

        foreach (var file in quizFiles)
        {
            var fileName = Path.GetFileName(file);
            var yaml = File.ReadAllText(file);

            // Deserialize with both naming conventions to handle mixed formats
            var quizCamel = YamlDeserializer.Deserialize<QuizYamlRoot>(yaml);
            var quizUnderscore = underscoreDeserializer.Deserialize<QuizYamlRoot>(yaml);

            // Pick the one that has better parsed results for each question
            var questions = quizCamel?.Questions ?? [];

            for (var i = 0; i < questions.Count; i++)
            {
                var q = questions[i];
                var qUnderscore = quizUnderscore?.Questions?.ElementAtOrDefault(i);

                // Merge correctOptionId/correctAnswer from both conventions
                var hasCorrectOptionId = !string.IsNullOrEmpty(q.CorrectOptionId)
                    || !string.IsNullOrEmpty(qUnderscore?.CorrectOptionId);
                var hasCorrectAnswer = !string.IsNullOrEmpty(q.CorrectAnswer)
                    || !string.IsNullOrEmpty(qUnderscore?.CorrectAnswer);

                if (hasCorrectOptionId || hasCorrectAnswer)
                {
                    continue; // Correct answer specified by another field
                }

                // Check if any option has isCorrect=true
                var hasCorrect = q.Options.Any(opt =>
                    opt is Dictionary<object, object> dict &&
                    dict.TryGetValue("isCorrect", out var val) &&
                    val is true or "true" or "True");

                hasCorrect.Should().BeTrue(
                    $"question in {fileName} must have at least one correct option (via isCorrect, correctOptionId, or correctAnswer)");
            }
        }
    }

    // ── Challenge YAML validation ──

    [Fact]
    public void ChallengeYaml_AllFilesDeserialize()
    {
        var challengeDir = Path.Combine(CurriculumPath, "challenges");
        Directory.Exists(challengeDir).Should().BeTrue("challenges directory must exist");

        var challengeFiles = Directory.GetFiles(challengeDir, "*.yaml");
        challengeFiles.Should().NotBeEmpty("there should be at least one challenge file");

        foreach (var file in challengeFiles)
        {
            var yaml = File.ReadAllText(file);
            var challenge = YamlDeserializer.Deserialize<ChallengeYamlRoot>(yaml);
            challenge.Should().NotBeNull($"challenge file {Path.GetFileName(file)} must deserialize");
        }
    }

    [Fact]
    public void ChallengeYaml_HasRequiredFields()
    {
        var challengeDir = Path.Combine(CurriculumPath, "challenges");
        var challengeFiles = Directory.GetFiles(challengeDir, "*.yaml");

        foreach (var file in challengeFiles)
        {
            var fileName = Path.GetFileName(file);
            var yaml = File.ReadAllText(file);
            var challenge = YamlDeserializer.Deserialize<ChallengeYamlRoot>(yaml);

            challenge!.StarterCode.Should().NotBeNullOrEmpty(
                $"challenge {fileName} must have starterCode");
            challenge.SolutionCode.Should().NotBeNullOrEmpty(
                $"challenge {fileName} must have solutionCode");
            challenge.TestCases.Should().NotBeNullOrEmpty(
                $"challenge {fileName} must have a non-empty testCases array");
            challenge.Hints.Should().NotBeNullOrEmpty(
                $"challenge {fileName} must have a non-empty hints array");
            challenge.RequiredPackages.Should().NotBeNull(
                $"challenge {fileName} must have requiredPackages (can be empty)");
        }
    }

    [Fact]
    public void ChallengeYaml_TestCasesHaveIdAndName()
    {
        var challengeDir = Path.Combine(CurriculumPath, "challenges");
        var challengeFiles = Directory.GetFiles(challengeDir, "*.yaml");

        foreach (var file in challengeFiles)
        {
            var fileName = Path.GetFileName(file);
            var yaml = File.ReadAllText(file);
            var challenge = YamlDeserializer.Deserialize<ChallengeYamlRoot>(yaml);

            for (var i = 0; i < challenge!.TestCases.Count; i++)
            {
                var tc = challenge.TestCases[i];
                tc.Id.Should().NotBeNullOrEmpty(
                    $"testCases[{i}] in {fileName} must have an 'id' field");
                tc.Name.Should().NotBeNullOrEmpty(
                    $"testCases[{i}] in {fileName} must have a 'name' field");
                tc.Type.Should().NotBeNullOrEmpty(
                    $"testCases[{i}] in {fileName} must have a 'type' field");
                tc.Description.Should().NotBeNullOrEmpty(
                    $"testCases[{i}] in {fileName} must have a 'description' field");
            }
        }
    }

    // ── Achievement YAML validation ──

    [Fact]
    public void AchievementsYaml_FileExistsAndDeserializes()
    {
        var path = Path.Combine(CurriculumPath, "achievements.yaml");
        File.Exists(path).Should().BeTrue($"achievements.yaml should exist at {path}");

        var yaml = File.ReadAllText(path);
        var root = YamlDeserializer.Deserialize<AchievementsYamlRoot>(yaml);
        root.Should().NotBeNull();
        root!.Achievements.Should().NotBeNullOrEmpty("achievements.yaml must have at least one achievement");
    }

    [Fact]
    public void AchievementsYaml_EachAchievementHasRequiredFields()
    {
        var path = Path.Combine(CurriculumPath, "achievements.yaml");
        var yaml = File.ReadAllText(path);
        var root = YamlDeserializer.Deserialize<AchievementsYamlRoot>(yaml)!;

        foreach (var a in root.Achievements)
        {
            a.Id.Should().NotBeNullOrEmpty("achievement must have an id");
            a.Name.Should().NotBeNullOrEmpty($"achievement '{a.Id}' must have a name");
            a.Description.Should().NotBeNullOrEmpty($"achievement '{a.Id}' must have a description");
            a.Icon.Should().NotBeNullOrEmpty($"achievement '{a.Id}' must have an icon");
            a.Category.Should().NotBeNullOrEmpty($"achievement '{a.Id}' must have a category");
            a.TriggerType.Should().NotBeNullOrEmpty($"achievement '{a.Id}' must have a triggerType");
            a.TriggerConfig.Should().NotBeNull($"achievement '{a.Id}' must have a triggerConfig");
            a.Rarity.Should().NotBeNullOrEmpty($"achievement '{a.Id}' must have a rarity");
        }
    }

    [Fact]
    public void AchievementsYaml_NoDuplicateIds()
    {
        var path = Path.Combine(CurriculumPath, "achievements.yaml");
        var yaml = File.ReadAllText(path);
        var root = YamlDeserializer.Deserialize<AchievementsYamlRoot>(yaml)!;

        var ids = root.Achievements.Select(a => a.Id).ToList();
        ids.Should().OnlyHaveUniqueItems("achievement IDs must be unique");
    }

    // ── Content file reference validation ──

    [Fact]
    public void WorldsYaml_AllUnlockAfterLessonIdsExist()
    {
        var root = LoadWorldsRoot();
        var allLessonIds = new HashSet<string>();
        var referencedIds = new List<(string lessonId, string referencedId)>();

        foreach (var world in root.Worlds)
            foreach (var module in world.Modules)
                foreach (var lesson in module.Lessons)
                {
                    allLessonIds.Add(lesson.Id);
                    if (!string.IsNullOrEmpty(lesson.UnlockAfterLesson))
                        referencedIds.Add((lesson.Id, lesson.UnlockAfterLesson));
                }

        var missing = referencedIds
            .Where(r => !allLessonIds.Contains(r.referencedId))
            .Select(r => $"lesson '{r.lessonId}' references unlockAfterLesson '{r.referencedId}'")
            .ToList();

        missing.Should().BeEmpty(
            $"all unlockAfterLesson references should point to existing lessons. Missing: {string.Join("; ", missing)}");
    }

    [Fact]
    public void WorldsYaml_SortOrdersAreContiguousWithinModules()
    {
        var root = LoadWorldsRoot();
        var issues = new List<string>();

        foreach (var world in root.Worlds)
            foreach (var module in world.Modules)
            {
                var sortOrders = module.Lessons.Select(l => l.SortOrder).OrderBy(s => s).ToList();
                var duplicates = sortOrders.GroupBy(s => s).Where(g => g.Count() > 1).Select(g => g.Key).ToList();
                if (duplicates.Any())
                    issues.Add($"module '{module.Id}' has duplicate sortOrders: {string.Join(", ", duplicates)}");

                if (sortOrders.Any() && sortOrders.First() != 1)
                    issues.Add($"module '{module.Id}' sortOrder doesn't start at 1 (starts at {sortOrders.First()})");
            }

        issues.Should().BeEmpty(
            $"sortOrders should be unique within modules and start at 1. Issues: {string.Join("; ", issues)}");
    }

    [Fact]
    public void ContentFiles_AllInteractiveBlocksContainValidJson()
    {
        var contentDir = Path.Combine(CurriculumPath, "content");
        var blockTypes = new[] { "reveal", "scenario", "deepdive", "compare", "terminal", "timeline" };
        var errors = new List<string>();

        foreach (var file in Directory.GetFiles(contentDir, "*.md", SearchOption.AllDirectories))
        {
            var content = File.ReadAllText(file);
            var fileName = Path.GetRelativePath(CurriculumPath, file);

            foreach (var blockType in blockTypes)
            {
                var pattern = $"```{blockType}\n";
                var startIdx = 0;
                var blockNum = 0;

                while ((startIdx = content.IndexOf(pattern, startIdx, StringComparison.Ordinal)) >= 0)
                {
                    blockNum++;
                    var jsonStart = startIdx + pattern.Length;
                    var jsonEnd = content.IndexOf("\n```", jsonStart, StringComparison.Ordinal);
                    if (jsonEnd < 0)
                    {
                        errors.Add($"{fileName}: {blockType} block {blockNum} — unclosed code fence");
                        break;
                    }

                    var json = content[jsonStart..jsonEnd].Trim();
                    try
                    {
                        JsonDocument.Parse(json);
                    }
                    catch (JsonException ex)
                    {
                        errors.Add($"{fileName}: {blockType} block {blockNum} — {ex.Message}");
                    }

                    startIdx = jsonEnd + 4;
                }
            }
        }

        errors.Should().BeEmpty(
            $"all interactive blocks must contain valid JSON. Errors:\n{string.Join("\n", errors)}");
    }

    [Fact]
    public void ContentFiles_LearnLessonsHaveContent()
    {
        var root = LoadWorldsRoot();
        var contentDir = Path.Combine(CurriculumPath, "content");
        var tooShort = new List<string>();

        foreach (var world in root.Worlds)
            foreach (var module in world.Modules)
                foreach (var lesson in module.Lessons)
                {
                    if (lesson.Type != "learn" || string.IsNullOrEmpty(lesson.ContentFile))
                        continue;

                    var path = Path.Combine(contentDir, lesson.ContentFile);
                    if (!File.Exists(path)) continue;

                    var content = File.ReadAllText(path);
                    if (content.Length < 200)
                        tooShort.Add($"lesson '{lesson.Id}' ({lesson.ContentFile}): only {content.Length} chars");
                }

        tooShort.Should().BeEmpty(
            $"learn lessons should have substantive content (>200 chars). Short files: {string.Join("; ", tooShort)}");
    }

    [Fact]
    public void WorldsYaml_AllContentFilesExistOnDisk()
    {
        var root = LoadWorldsRoot();
        var contentDir = Path.Combine(CurriculumPath, "content");
        var missing = new List<string>();

        foreach (var world in root.Worlds)
        {
            foreach (var module in world.Modules)
            {
                foreach (var lesson in module.Lessons)
                {
                    if (!string.IsNullOrEmpty(lesson.ContentFile))
                    {
                        var fullPath = Path.Combine(contentDir, lesson.ContentFile);
                        if (!File.Exists(fullPath))
                        {
                            missing.Add($"lesson '{lesson.Id}' references contentFile '{lesson.ContentFile}'");
                        }
                    }
                }
            }
        }

        missing.Should().BeEmpty(
            $"all referenced content files should exist on disk. Missing: {string.Join("; ", missing)}");
    }

    [Fact]
    public void WorldsYaml_AllQuizFilesExistOnDisk()
    {
        var root = LoadWorldsRoot();
        var quizDir = Path.Combine(CurriculumPath, "quizzes");
        var missing = new List<string>();

        foreach (var world in root.Worlds)
        {
            foreach (var module in world.Modules)
            {
                foreach (var lesson in module.Lessons)
                {
                    if (!string.IsNullOrEmpty(lesson.QuizFile))
                    {
                        var fullPath = Path.Combine(quizDir, lesson.QuizFile);
                        if (!File.Exists(fullPath))
                        {
                            missing.Add($"lesson '{lesson.Id}' references quizFile '{lesson.QuizFile}'");
                        }
                    }
                }
            }
        }

        missing.Should().BeEmpty(
            $"all referenced quiz files should exist. Missing: {string.Join("; ", missing)}");
    }

    [Fact]
    public void WorldsYaml_AllChallengeFilesExistOnDisk()
    {
        var root = LoadWorldsRoot();
        var challengeDir = Path.Combine(CurriculumPath, "challenges");
        var missing = new List<string>();

        foreach (var world in root.Worlds)
        {
            foreach (var module in world.Modules)
            {
                foreach (var lesson in module.Lessons)
                {
                    if (!string.IsNullOrEmpty(lesson.ChallengeFile))
                    {
                        var fullPath = Path.Combine(challengeDir, lesson.ChallengeFile);
                        if (!File.Exists(fullPath))
                        {
                            missing.Add($"lesson '{lesson.Id}' references challengeFile '{lesson.ChallengeFile}'");
                        }
                    }
                }
            }
        }

        missing.Should().BeEmpty(
            $"all referenced challenge files should exist. Missing: {string.Join("; ", missing)}");
    }

    // ── gallery.json validation ──

    [Fact]
    public void GalleryJson_FileExists()
    {
        var path = Path.Combine(CurriculumPath, "gallery.json");
        File.Exists(path).Should().BeTrue($"gallery.json should exist at {path}");
    }

    [Fact]
    public void GalleryJson_DeserializesWithoutErrors()
    {
        var gallery = LoadGalleryJson();
        gallery.ValueKind.Should().Be(JsonValueKind.Array);
    }

    [Fact]
    public void GalleryJson_HasAtLeast1Entry()
    {
        var gallery = LoadGalleryJson();
        gallery.GetArrayLength().Should().BeGreaterThan(0);
    }

    [Fact]
    public void GalleryJson_EachEntryHasRequiredFields()
    {
        var gallery = LoadGalleryJson();

        foreach (var entry in gallery.EnumerateArray())
        {
            var id = entry.GetProperty("id").GetString();
            id.Should().NotBeNullOrEmpty();

            entry.TryGetProperty("title", out _).Should().BeTrue($"gallery entry '{id}' must have a title");
            entry.TryGetProperty("description", out _).Should().BeTrue($"gallery entry '{id}' must have a description");
            entry.TryGetProperty("services", out var services).Should().BeTrue($"gallery entry '{id}' must have services");
            services.GetArrayLength().Should().BeGreaterThan(0, $"gallery entry '{id}' must have at least one service");
            entry.TryGetProperty("connections", out _).Should().BeTrue($"gallery entry '{id}' must have connections");
            entry.TryGetProperty("code", out _).Should().BeTrue($"gallery entry '{id}' must have code");
            entry.TryGetProperty("concepts", out _).Should().BeTrue($"gallery entry '{id}' must have concepts");
        }
    }

    // ── concepts.json validation ──

    [Fact]
    public void ConceptsJson_FileExists()
    {
        var path = Path.Combine(CurriculumPath, "concepts.json");
        File.Exists(path).Should().BeTrue($"concepts.json should exist at {path}");
    }

    [Fact]
    public void ConceptsJson_DeserializesWithoutErrors()
    {
        var concepts = LoadConceptsJson();
        concepts.ValueKind.Should().Be(JsonValueKind.Object);
    }

    [Fact]
    public void ConceptsJson_HasLayerOrderAndLayers()
    {
        var concepts = LoadConceptsJson();

        concepts.TryGetProperty("layerOrder", out var layerOrder).Should().BeTrue();
        layerOrder.GetArrayLength().Should().BeGreaterThan(0);

        concepts.TryGetProperty("layers", out var layers).Should().BeTrue();
        layers.ValueKind.Should().Be(JsonValueKind.Object);

        // Every layer referenced in layerOrder must exist in layers
        foreach (var layer in layerOrder.EnumerateArray())
        {
            var key = layer.GetString()!;
            layers.TryGetProperty(key, out _).Should().BeTrue($"layer '{key}' from layerOrder must exist in layers");
        }
    }

    [Fact]
    public void ConceptsJson_HasConcepts()
    {
        var concepts = LoadConceptsJson();
        concepts.TryGetProperty("concepts", out var conceptsArr).Should().BeTrue();
        conceptsArr.GetArrayLength().Should().BeGreaterThan(0);
    }

    [Fact]
    public void ConceptsJson_AllLessonIdsExistInCurriculum()
    {
        var worldsRoot = LoadWorldsRoot();
        var allLessonIds = new HashSet<string>();
        foreach (var world in worldsRoot.Worlds)
            foreach (var module in world.Modules)
                foreach (var lesson in module.Lessons)
                    allLessonIds.Add(lesson.Id);

        var concepts = LoadConceptsJson();
        var missing = new List<string>();

        foreach (var concept in concepts.GetProperty("concepts").EnumerateArray())
        {
            var lessonId = concept.GetProperty("lessonId").GetString()!;
            var conceptId = concept.GetProperty("id").GetString()!;

            if (!allLessonIds.Contains(lessonId))
                missing.Add($"concept '{conceptId}' references lesson '{lessonId}'");
        }

        missing.Should().BeEmpty(
            $"all concept lessonIds should reference existing lessons. Missing: {string.Join("; ", missing)}");
    }

    // ── Helpers ──

    private static WorldsYamlRoot LoadWorldsRoot()
    {
        var path = Path.Combine(CurriculumPath, "worlds.yaml");
        var yaml = File.ReadAllText(path);
        return YamlDeserializer.Deserialize<WorldsYamlRoot>(yaml)!;
    }

    private static JsonElement LoadGalleryJson()
    {
        var path = Path.Combine(CurriculumPath, "gallery.json");
        var json = File.ReadAllText(path);
        return JsonDocument.Parse(json).RootElement;
    }

    private static JsonElement LoadConceptsJson()
    {
        var path = Path.Combine(CurriculumPath, "concepts.json");
        var json = File.ReadAllText(path);
        return JsonDocument.Parse(json).RootElement;
    }
}

// ── YAML deserialization models for validation tests ──

class WorldsYamlRoot
{
    public List<WorldYamlDef> Worlds { get; set; } = [];
}

class WorldYamlDef
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Icon { get; set; } = "";
    public int SortOrder { get; set; }
    public List<ModuleYamlDef> Modules { get; set; } = [];
}

class ModuleYamlDef
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public int SortOrder { get; set; }
    public List<LessonYamlDef> Lessons { get; set; } = [];
}

class LessonYamlDef
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Type { get; set; } = "";
    public int SortOrder { get; set; }
    public int XpReward { get; set; }
    public string? ContentFile { get; set; }
    public string? QuizFile { get; set; }
    public string? ChallengeFile { get; set; }
    public string? UnlockAfterLesson { get; set; }
}

class QuizYamlRoot
{
    public List<QuizQuestionYamlDef> Questions { get; set; } = [];
}

class QuizQuestionYamlDef
{
    public string? Text { get; set; }
    public string? Question { get; set; }
    public string Type { get; set; } = "";
    public List<object> Options { get; set; } = [];
    public string? CorrectOptionId { get; set; }
    public string? CorrectAnswer { get; set; }
    public string Explanation { get; set; } = "";
}

class ChallengeYamlRoot
{
    public string StarterCode { get; set; } = "";
    public string SolutionCode { get; set; } = "";
    public List<ChallengeTestCaseYaml> TestCases { get; set; } = [];
    public List<string> Hints { get; set; } = [];
    public List<string> RequiredPackages { get; set; } = [];
}

class ChallengeTestCaseYaml
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public string Description { get; set; } = "";
    public string? Value { get; set; }
    public string? Expected { get; set; }
}

class AchievementsYamlRoot
{
    public List<AchievementYamlDef> Achievements { get; set; } = [];
}

class AchievementYamlDef
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public string Icon { get; set; } = "";
    public string Category { get; set; } = "";
    public string TriggerType { get; set; } = "";
    public Dictionary<string, object> TriggerConfig { get; set; } = [];
    public string Rarity { get; set; } = "";
}
