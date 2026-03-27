using System.Net;
using System.Net.Http.Json;
using AspireAcademy.Api.Endpoints;
using FluentAssertions;

namespace AspireAcademy.Api.Tests;

public class DailyRewardAndHealthTests : TestFixture
{
    // ── Health Endpoints ──

    [Fact]
    public async Task AliveEndpoint_ReturnsOk()
    {
        // /alive only checks the "self" liveness check (no external deps)
        var response = await Client.GetAsync("/alive");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task HealthEndpoint_ReturnsResponse()
    {
        // /health checks all registered health checks (DB, Redis, etc.)
        // In test env with fake Redis, it may return 503 (Unhealthy) or 200 (Healthy)
        // — we just verify it responds and doesn't crash
        var response = await Client.GetAsync("/health");

        response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.ServiceUnavailable);
    }

    // ── Daily Reward ──

    [Fact]
    public async Task ClaimDailyReward_FirstTime_AwardsXp()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PostAsync("/api/daily-reward", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<DailyRewardResponse>(response);

        body.Should().NotBeNull();
        body!.Awarded.Should().BeTrue();
        body.XpAwarded.Should().BeGreaterThan(0);
        body!.StreakDays.Should().BeGreaterThanOrEqualTo(1);
        body.AlreadyClaimed.Should().BeFalse();
    }

    [Fact]
    public async Task ClaimDailyReward_SecondTimeToday_ReturnsAlreadyClaimed()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        // Claim once
        await client.PostAsync("/api/daily-reward", null);

        // Claim again same day
        var response = await client.PostAsync("/api/daily-reward", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<DailyRewardResponse>(response);

        body.Should().NotBeNull();
        body!.Awarded.Should().BeFalse();
        body.AlreadyClaimed.Should().BeTrue();
    }

    [Fact]
    public async Task ClaimDailyReward_WithoutAuth_Returns401()
    {
        var response = await Client.PostAsync("/api/daily-reward", null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
