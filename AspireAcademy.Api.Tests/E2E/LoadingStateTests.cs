using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

/// <summary>
/// Loading/skeleton state tests — verify pages render gracefully under slow APIs.
/// These tests mock API routes to simulate slow responses.
/// </summary>
[Collection("AppHost")]
[Trait("Category", "E2E")]
public class LoadingStateTests(AppHostPlaywrightFixture fixture)
{
    private static readonly object FakeUser = new
    {
        id = "test-id",
        username = "testuser",
        displayName = "Test User",
        email = "test@test.com",
        avatarUrl = "",
        bio = (string?)null,
        currentLevel = 1,
        currentRank = "aspire-intern",
        totalXp = 0,
        loginStreakDays = 0,
        createdAt = DateTime.UtcNow.ToString("O"),
    };

    [Fact]
    public async Task DashboardShowsContentWhileApiIsSlow()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.RouteAsync("**/api/worlds", async route =>
            {
                await Task.Delay(3000);
                await route.FulfillAsync(new() { Status = 200, Body = "[]", ContentType = "application/json" });
            });
            await page.RouteAsync("**/api/xp", async route =>
            {
                await Task.Delay(3000);
                await route.FulfillAsync(new()
                {
                    Status = 200,
                    Body = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        totalXp = 0, currentLevel = 1, currentRank = "aspire-intern",
                        weeklyXp = 0, loginStreakDays = 0, recentEvents = Array.Empty<object>(),
                    }),
                    ContentType = "application/json"
                });
            });
            await page.RouteAsync("**/api/auth/me", async route =>
            {
                await route.FulfillAsync(new()
                {
                    Status = 200,
                    Body = System.Text.Json.JsonSerializer.Serialize(FakeUser),
                    ContentType = "application/json"
                });
            });

            await page.AddInitScriptAsync(@"
                (function() {
                    localStorage.setItem('aspire-academy-auth',
                        JSON.stringify({ state: { token: 'fake-token', user: " +
                        System.Text.Json.JsonSerializer.Serialize(FakeUser) + @" }, version: 0 }));
                })();
            ");

            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 15_000 });
        }
        finally { await page.CloseAsync(); }
    }

    [Fact]
    public async Task LeaderboardShowsTabsWhileFetching()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("loadlb");
            await RegisterUser(page, username);

            await page.RouteAsync("**/api/leaderboard*", async route =>
            {
                await Task.Delay(3000);
                await route.ContinueAsync();
            });

            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("weekly", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await page.CloseAsync(); }
    }
}
