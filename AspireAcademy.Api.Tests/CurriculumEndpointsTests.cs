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
        world2.IsUnlocked.Should().BeFalse();
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
    public async Task GetWorlds_WithoutAuth_Returns401()
    {
        var response = await Client.GetAsync("/api/worlds");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
