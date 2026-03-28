using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using AspireAcademy.Api.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

public class CurriculumEndpointsTests : TestFixture
{
    [Fact]
    public async Task GetWorlds_ReturnsAllWorldsWithCompletionStats()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.GetAsync("/api/worlds");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var worlds = await ReadJsonAsync<List<WorldDto>>(response);
        worlds.Should().NotBeNull();
        worlds.Should().HaveCount(2);

        var world1 = worlds!.First(w => w.Id == "world-1");
        world1.Name.Should().Be("Web Fundamentals");
        world1.IsUnlocked.Should().BeTrue();
        world1.CompletionPercentage.Should().Be(0);
        world1.TotalLessons.Should().BeGreaterThan(0);
        world1.CompletedLessons.Should().Be(0);

        var world2 = worlds.First(w => w.Id == "world-2");
        world2.IsUnlocked.Should().BeTrue();
    }

    [Fact]
    public async Task GetWorldModules_ReturnsModulesForWorld()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.GetAsync("/api/worlds/world-1/modules");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var modules = await ReadJsonAsync<List<ModuleDto>>(response);
        modules.Should().NotBeNull();
        modules.Should().HaveCount(2);

        var mod1 = modules!.First(m => m.Id == "mod-1");
        mod1.Name.Should().Be("Getting Started");
        mod1.IsUnlocked.Should().BeTrue();
        mod1.LessonCount.Should().BeGreaterThan(0);

        var mod2 = modules.First(m => m.Id == "mod-2");
        mod2.IsUnlocked.Should().BeFalse();
    }

    [Fact]
    public async Task GetLessonDetail_ReturnsLessonWithContent()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.GetAsync("/api/lessons/lesson-learn-1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var lesson = await ReadJsonAsync<LessonDetailDto>(response);
        lesson.Should().NotBeNull();
        lesson!.Id.Should().Be("lesson-learn-1");
        lesson.Title.Should().Be("Intro to Aspire");
        lesson.Type.Should().Be("learn");
        lesson.ContentMarkdown.Should().Contain("Welcome");
        lesson.XpReward.Should().Be(50);
        lesson.Status.Should().Be("not-started");
    }

    [Fact]
    public async Task GetModuleLessons_LockedLessonShowsIsUnlockedFalse()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.GetAsync("/api/modules/mod-2/lessons");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var lessons = await ReadJsonAsync<List<LessonListDto>>(response);
        lessons.Should().NotBeNull();

        var locked = lessons!.First(l => l.Id == "lesson-locked-1");
        locked.IsUnlocked.Should().BeFalse();
        locked.Status.Should().Be("not-started");
    }

    [Fact]
    public async Task GetLessonDetail_QuizQuestionsDoNotIncludeCorrectAnswers()
    {
        // First complete the prereq lesson so quiz is accessible
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();
        db.UserProgress.Add(new UserProgress
        {
            Id = Guid.NewGuid(),
            UserId = TestUserId,
            LessonId = "lesson-learn-1",
            Status = "completed",
            Attempts = 1,
            CompletedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.GetAsync("/api/lessons/lesson-quiz-1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Read as raw JSON to verify no "isCorrect" field is present
        var rawJson = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(rawJson);
        var quiz = doc.RootElement.GetProperty("quiz");
        var questions = quiz.GetProperty("questions");

        foreach (var question in questions.EnumerateArray())
        {
            var options = question.GetProperty("options");
            foreach (var option in options.EnumerateArray())
            {
                option.TryGetProperty("isCorrect", out _).Should().BeFalse(
                    "quiz options in the response should not reveal correct answers");
            }
        }

        // Also verify the quiz has questions and passing score
        var lessonDto = await ReadJsonAsync<LessonDetailDto>(
            await authClient.GetAsync("/api/lessons/lesson-quiz-1"));
        lessonDto!.Quiz.Should().NotBeNull();
        lessonDto.Quiz!.Questions.Should().HaveCount(2);
        lessonDto.Quiz.PassingScore.Should().Be(70);
        lessonDto.Quiz.TotalPoints.Should().Be(20);
    }

    [Fact]
    public async Task GetWorlds_WithoutAuth_ReturnsWorldsWithAllUnlocked()
    {
        var response = await Client.GetAsync("/api/worlds");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var worlds = await ReadJsonAsync<List<WorldDto>>(response);
        worlds.Should().NotBeNull();
        worlds.Should().HaveCount(2);
        worlds!.Should().AllSatisfy(w => w.IsUnlocked.Should().BeTrue(),
            "anonymous users should see all worlds as unlocked");
    }

    // ── Gallery endpoint ──

    [Fact]
    public async Task GetGallery_ReturnsGalleryEntries()
    {
        var response = await Client.GetAsync("/api/gallery");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var rawJson = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(rawJson);
        doc.RootElement.ValueKind.Should().Be(JsonValueKind.Array);
        doc.RootElement.GetArrayLength().Should().BeGreaterThan(0);

        var first = doc.RootElement[0];
        first.TryGetProperty("id", out _).Should().BeTrue("each entry must have an id");
        first.TryGetProperty("title", out _).Should().BeTrue("each entry must have a title");
        first.TryGetProperty("services", out _).Should().BeTrue("each entry must have services");
        first.TryGetProperty("connections", out _).Should().BeTrue("each entry must have connections");
        first.TryGetProperty("code", out _).Should().BeTrue("each entry must have code");
        first.TryGetProperty("concepts", out _).Should().BeTrue("each entry must have concepts");
    }

    [Fact]
    public async Task GetGallery_DoesNotRequireAuth()
    {
        // Use unauthenticated client
        var response = await Client.GetAsync("/api/gallery");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetGallery_EntriesHaveValidStructure()
    {
        var response = await Client.GetAsync("/api/gallery");
        var rawJson = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(rawJson);

        foreach (var entry in doc.RootElement.EnumerateArray())
        {
            var id = entry.GetProperty("id").GetString();
            id.Should().NotBeNullOrEmpty();

            var services = entry.GetProperty("services");
            services.GetArrayLength().Should().BeGreaterThan(0, $"gallery entry '{id}' must have services");

            foreach (var svc in services.EnumerateArray())
            {
                svc.TryGetProperty("id", out _).Should().BeTrue($"service in '{id}' must have an id");
                svc.TryGetProperty("name", out _).Should().BeTrue($"service in '{id}' must have a name");
                svc.TryGetProperty("type", out _).Should().BeTrue($"service in '{id}' must have a type");
            }

            var code = entry.GetProperty("code").GetString();
            code.Should().NotBeNullOrEmpty($"gallery entry '{id}' must have code");
            code.Should().Contain("DistributedApplication", $"gallery entry '{id}' code should be Aspire AppHost code");
        }
    }

    // ── Concepts endpoint ──

    [Fact]
    public async Task GetConcepts_ReturnsConceptsData()
    {
        var response = await Client.GetAsync("/api/concepts");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var rawJson = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(rawJson);
        doc.RootElement.ValueKind.Should().Be(JsonValueKind.Object);

        doc.RootElement.TryGetProperty("layerOrder", out var layerOrder).Should().BeTrue();
        layerOrder.GetArrayLength().Should().BeGreaterThan(0);

        doc.RootElement.TryGetProperty("layers", out var layers).Should().BeTrue();
        layers.ValueKind.Should().Be(JsonValueKind.Object);

        doc.RootElement.TryGetProperty("concepts", out var concepts).Should().BeTrue();
        concepts.GetArrayLength().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task GetConcepts_DoesNotRequireAuth()
    {
        var response = await Client.GetAsync("/api/concepts");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetConcepts_ConceptsHaveValidStructure()
    {
        var response = await Client.GetAsync("/api/concepts");
        var rawJson = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(rawJson);

        var layerOrder = doc.RootElement.GetProperty("layerOrder");
        var layers = doc.RootElement.GetProperty("layers");
        var concepts = doc.RootElement.GetProperty("concepts");

        // Every layer in layerOrder should exist in layers object
        foreach (var layer in layerOrder.EnumerateArray())
        {
            var key = layer.GetString()!;
            layers.TryGetProperty(key, out var layerDef).Should().BeTrue($"layer '{key}' from layerOrder must exist in layers");
            layerDef.TryGetProperty("name", out _).Should().BeTrue($"layer '{key}' must have a name");
            layerDef.TryGetProperty("color", out _).Should().BeTrue($"layer '{key}' must have a color");
            layerDef.TryGetProperty("emoji", out _).Should().BeTrue($"layer '{key}' must have an emoji");
        }

        // Every concept should reference a valid layer
        var validLayers = new HashSet<string>();
        foreach (var layer in layerOrder.EnumerateArray())
            validLayers.Add(layer.GetString()!);

        foreach (var concept in concepts.EnumerateArray())
        {
            var id = concept.GetProperty("id").GetString();
            id.Should().NotBeNullOrEmpty();

            concept.TryGetProperty("label", out _).Should().BeTrue($"concept '{id}' must have a label");
            concept.TryGetProperty("description", out _).Should().BeTrue($"concept '{id}' must have a description");
            concept.TryGetProperty("lessonId", out _).Should().BeTrue($"concept '{id}' must have a lessonId");

            var layer = concept.GetProperty("layer").GetString();
            validLayers.Should().Contain(layer, $"concept '{id}' references unknown layer '{layer}'");
        }
    }

    // ── Cross-module navigation ──

    [Fact]
    public async Task GetLessonDetail_LastLessonInModule_HasNextLessonFromNextModule()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // lesson-challenge-1 is the last lesson in mod-1; mod-2 is the next module in world-1
        var response = await authClient.GetAsync("/api/lessons/lesson-challenge-1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var lesson = await ReadJsonAsync<LessonDetailDto>(response);
        lesson.Should().NotBeNull();
        lesson!.NextLessonId.Should().Be("lesson-locked-1",
            "last lesson in a module should link to the first lesson of the next module in the same world");
        lesson.NextLessonTitle.Should().Be("Locked Lesson");
    }

    [Fact]
    public async Task GetLessonDetail_FirstLessonInModule_HasPreviousLessonFromPreviousModule()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // lesson-locked-1 is the first lesson in mod-2; mod-1 is the previous module in world-1
        var response = await authClient.GetAsync("/api/lessons/lesson-locked-1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var lesson = await ReadJsonAsync<LessonDetailDto>(response);
        lesson.Should().NotBeNull();
        lesson!.PreviousLessonId.Should().Be("lesson-challenge-1",
            "first lesson in a module should link to the last lesson of the previous module in the same world");
        lesson.PreviousLessonTitle.Should().Be("Code Challenge");
    }

    // ── Lesson stats endpoint ──

    [Fact]
    public async Task GetLessonStats_WithCompletions_ReturnsCorrectCount()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

        var user2Id = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000001");
        var user3Id = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000002");

        db.Users.AddRange(
            new User { Id = user2Id, Username = "statsuser2", Email = "stats2@test.com", PasswordHash = TestPasswordHash, DisplayName = "Stats User 2", CreatedAt = DateTime.UtcNow },
            new User { Id = user3Id, Username = "statsuser3", Email = "stats3@test.com", PasswordHash = TestPasswordHash, DisplayName = "Stats User 3", CreatedAt = DateTime.UtcNow });

        db.UserProgress.AddRange(
            new UserProgress { Id = Guid.NewGuid(), UserId = TestUserId, LessonId = "lesson-learn-1", Status = ProgressStatuses.Completed, Attempts = 1, CompletedAt = DateTime.UtcNow },
            new UserProgress { Id = Guid.NewGuid(), UserId = user2Id, LessonId = "lesson-learn-1", Status = ProgressStatuses.Perfect, Attempts = 1, CompletedAt = DateTime.UtcNow },
            new UserProgress { Id = Guid.NewGuid(), UserId = user3Id, LessonId = "lesson-learn-1", Status = ProgressStatuses.InProgress, Attempts = 1 });

        await db.SaveChangesAsync();

        var response = await Client.GetAsync("/api/lessons/lesson-learn-1/stats");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.GetProperty("completionCount").GetInt32().Should().Be(2,
            "only 'completed' and 'perfect' statuses count; 'in-progress' does not");
    }

    [Fact]
    public async Task GetLessonStats_NoCompletions_ReturnsZero()
    {
        var response = await Client.GetAsync("/api/lessons/lesson-challenge-1/stats");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.GetProperty("completionCount").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task GetLessonStats_NonExistentLesson_Returns404()
    {
        var response = await Client.GetAsync("/api/lessons/does-not-exist/stats");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
