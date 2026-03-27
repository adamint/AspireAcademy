using System.Net;
using System.Net.Http.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using AspireAcademy.Api.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

public class ChallengeEndpointsTests : TestFixture
{
    public override async Task InitializeAsync()
    {
        await base.InitializeAsync();

        // Complete prerequisites so the challenge lesson is unlocked:
        // lesson-learn-1 → lesson-quiz-1 → lesson-challenge-1
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();
        db.UserProgress.AddRange(
            new UserProgress
            {
                Id = Guid.NewGuid(),
                UserId = TestUserId,
                LessonId = "lesson-learn-1",
                Status = "completed",
                Attempts = 1,
                XpEarned = 50,
                CompletedAt = DateTime.UtcNow
            },
            new UserProgress
            {
                Id = Guid.NewGuid(),
                UserId = TestUserId,
                LessonId = "lesson-quiz-1",
                Status = "completed",
                Attempts = 1,
                XpEarned = 100,
                CompletedAt = DateTime.UtcNow
            });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task RunCode_ReturnsStructuralValidationResult()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var request = new ChallengeRunRequest("Console.WriteLine(\"Hello World\");", 0);
        var response = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/run", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<ChallengeRunResponse>(response);
        body.Should().NotBeNull();
        body!.CompilationSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task SubmitChallenge_WithPassingCode_AllApplicableTestsPassAndXpAwarded()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // This code passes both "compiles" (valid structure) and "output-contains" is skipped,
        // but the seed data test cases are "compiles" + "output-contains".
        // "output-contains" is skipped (runtime), so only "compiles" is applicable.
        var request = new ChallengeRunRequest("Console.WriteLine(\"Hello World\");", 0);
        var response = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<ChallengeSubmitResponse>(response);
        body.Should().NotBeNull();
        body!.CompilationSuccess.Should().BeTrue();
        body.AllPassed.Should().BeTrue();
        body.TestResults.Should().HaveCount(2);
        // "compiles" should pass, "output-contains" is skipped (marked as failed)
        body.TestResults.Should().Contain(t => t.Name == "Compiles" && t.Passed);
        body.XpEarned.Should().Be(150); // lesson XpReward
    }

    [Fact]
    public async Task SubmitChallenge_WithBrokenCode_ShowsTestFailures()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // Unbalanced braces → structure invalid
        var request = new ChallengeRunRequest("if (true) {", 0);
        var response = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<ChallengeSubmitResponse>(response);
        body.Should().NotBeNull();
        body!.CompilationSuccess.Should().BeFalse();
        body.AllPassed.Should().BeFalse();
        // The "compiles" test case should fail
        body.TestResults.Should().Contain(t => t.Name == "Compiles" && !t.Passed);
    }

    [Fact]
    public async Task RunCode_RateLimiting_Returns429AfterExceedingLimit()
    {
        Factory.FakeRedis.Reset();

        using var authClient = CreateAuthenticatedClient(TestUserId);
        var request = new ChallengeRunRequest("Console.WriteLine(\"hi\");", 0);

        // Make 10 requests (the limit)
        for (var i = 0; i < 10; i++)
        {
            var resp = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/run", request);
            resp.StatusCode.Should().Be(HttpStatusCode.OK, $"request {i + 1} should succeed");
        }

        // The 11th should be rate limited
        var rateLimitedResponse = await authClient.PostAsJsonAsync("/api/challenges/lesson-challenge-1/run", request);
        rateLimitedResponse.StatusCode.Should().Be((HttpStatusCode)429);
    }

    [Fact]
    public async Task SubmitChallenge_WithoutAuth_Returns401()
    {
        var request = new ChallengeRunRequest("code", 0);
        var response = await Client.PostAsJsonAsync("/api/challenges/lesson-challenge-1/submit", request);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
