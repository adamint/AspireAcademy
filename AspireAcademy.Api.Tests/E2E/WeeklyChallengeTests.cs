using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class WeeklyChallengeTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task WeeklyChallenge_Renders()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("weekly");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/weekly-challenge");
            
            // Verify weekly challenge page loads
            await Assertions.Expect(page.GetByText(new Regex("weekly.*challenge", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task WeeklyChallenge_ShowsCountdown()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("countdown");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/weekly-challenge");
            
            // Verify countdown/reset timer element visible
            var countdown = page.GetByText(new Regex("resets? in|countdown|timer|time.*left|\\d+[dhms]", RegexOptions.IgnoreCase))
                .Or(page.Locator("[data-testid*='countdown'], [data-testid*='timer']"));
            await Assertions.Expect(countdown.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task WeeklyChallenge_ShowsLeaderboard()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("leaderboard");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/weekly-challenge");
            
            // Verify leaderboard section exists
            var leaderboard = page.GetByText(new Regex("leaderboard|rankings?|top.*users?", RegexOptions.IgnoreCase))
                .Or(page.Locator("[data-testid*='leaderboard']"));
            await Assertions.Expect(leaderboard.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}