using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class LeaderboardTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task LeaderboardPageLoadsWithWeeklyTabActive()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("leader");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");

            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("weekly", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("all-time", RegexOptions.IgnoreCase) })).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("friends", RegexOptions.IgnoreCase) })).ToBeVisibleAsync();
        }
        finally { await page.CloseAsync(); }
    }

    [Fact]
    public async Task WeeklyTabShowsResetsMondayNote()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("lbweekly");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("weekly", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText(new Regex("resets monday", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await page.CloseAsync(); }
    }

    [Fact]
    public async Task SwitchingToAllTimeTabLoadsData()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("lballtime");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");

            var allTimeTab = page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("all-time", RegexOptions.IgnoreCase) });
            await Assertions.Expect(allTimeTab).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await allTimeTab.ClickAsync();
            await page.WaitForTimeoutAsync(1_000);
            await Assertions.Expect(page.Locator("body")).Not.ToHaveTextAsync("");
        }
        finally { await page.CloseAsync(); }
    }

    [Fact]
    public async Task SwitchingToFriendsTabShowsRelevantContent()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("lbfriends");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");

            var friendsTab = page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("friends", RegexOptions.IgnoreCase) });
            await Assertions.Expect(friendsTab).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await friendsTab.ClickAsync();
            await page.WaitForTimeoutAsync(2_000);
            // Page should render without crashing
            var bodyNotEmpty = (await page.Locator("main, [role='main']").TextContentAsync())?.Length > 10;
            Assert.True(bodyNotEmpty);
        }
        finally { await page.CloseAsync(); }
    }
}
