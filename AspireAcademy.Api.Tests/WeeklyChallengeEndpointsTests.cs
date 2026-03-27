using System.Net;
using System.Net.Http.Json;
using AspireAcademy.Api.Endpoints;
using FluentAssertions;

namespace AspireAcademy.Api.Tests;

public class WeeklyChallengeEndpointsTests : TestFixture
{
    [Fact]
    public async Task GetCurrentWeeklyChallenge_ReturnsChallenge()
    {
        // No auth required
        var response = await Client.GetAsync("/api/weekly-challenge/");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<WeeklyChallengeResponse>(response);

        body.Should().NotBeNull();
        body!.LessonId.Should().NotBeNullOrEmpty();
        body.Title.Should().NotBeNullOrEmpty();
        body!.WeekNumber.Should().BeGreaterThanOrEqualTo(0);
        body.WeekEnd.Should().BeAfter(body.WeekStart);
        // Anonymous user — not completed
        body.UserCompleted.Should().BeFalse();
    }

    [Fact]
    public async Task GetCurrentWeeklyChallenge_Authenticated_ShowsCompletionStatus()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/weekly-challenge/");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<WeeklyChallengeResponse>(response);

        body.Should().NotBeNull();
        // User hasn't completed it
        body!.UserCompleted.Should().BeFalse();
        body.UserCompletedAt.Should().BeNull();
    }

    [Fact]
    public async Task GetWeeklyLeaderboard_ReturnsEmptyByDefault()
    {
        var response = await Client.GetAsync("/api/weekly-challenge/leaderboard");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<WeeklyLeaderboardResponse>(response);

        body.Should().NotBeNull();
        body!.Entries.Should().BeEmpty();
        body.TotalCompleters.Should().Be(0);
    }

    [Fact]
    public async Task GetPreviousWeeklyChallenges_ReturnsList()
    {
        var response = await Client.GetAsync("/api/weekly-challenge/previous");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<List<PreviousWeeklyChallenge>>(response);

        body.Should().NotBeNull();
        // Should return up to 3 previous weeks (may be empty if week number < 1)
        body!.Count.Should().BeLessThanOrEqualTo(3);
    }

    [Fact]
    public async Task GetWeeklyChallenge_IsDeterministic()
    {
        // Two calls in the same week should return the same challenge
        var r1 = await Client.GetAsync("/api/weekly-challenge/");
        var r2 = await Client.GetAsync("/api/weekly-challenge/");

        var body1 = await ReadJsonAsync<WeeklyChallengeResponse>(r1);
        var body2 = await ReadJsonAsync<WeeklyChallengeResponse>(r2);

        body1!.LessonId.Should().Be(body2!.LessonId);
        body1.WeekNumber.Should().Be(body2.WeekNumber);
    }
}
