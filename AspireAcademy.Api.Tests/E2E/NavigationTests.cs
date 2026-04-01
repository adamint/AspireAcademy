using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class NavigationTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task SidebarHomeLinkNavigates()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("nav");
            await RegisterUser(page, username);
            await page.GetByRole(AriaRole.Navigation).GetByText("Home").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex(@"/(dashboard|$)"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SidebarDashboardLinkNavigates()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navdash");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await page.GetByRole(AriaRole.Navigation).GetByText("Dashboard").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/dashboard"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SidebarProfileLinkNavigates()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navprof");
            await RegisterUser(page, username);
            await page.GetByRole(AriaRole.Navigation).GetByText("Profile").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/profile"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SidebarFriendsLinkNavigates()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navfriend");
            await RegisterUser(page, username);
            await page.GetByRole(AriaRole.Navigation).GetByText("Friends").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/friends"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SidebarLeaderboardLinkNavigates()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navlb");
            await RegisterUser(page, username);
            await page.GetByRole(AriaRole.Navigation).GetByText("Leaderboard").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/leaderboard"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SidebarAchievementsLinkNavigates()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navach");
            await RegisterUser(page, username);
            await page.GetByRole(AriaRole.Navigation).GetByText("Achievements").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/achievements"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task DashboardClickWorldNavigatesToWorldPage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navworld");
            await RegisterUser(page, username);
            var main = page.GetByRole(AriaRole.Main);
            await Assertions.Expect(main.GetByText("The Distributed Problem").First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await main.GetByText("The Distributed Problem").First.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/worlds/"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task WorldPageBackToDashboardLinkWorks()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navback");
            await RegisterUser(page, username);
            var main = page.GetByRole(AriaRole.Main);
            await Assertions.Expect(main.GetByText("The Distributed Problem").First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await main.GetByText("The Distributed Problem").First.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/worlds/"), new() { Timeout = 10_000 });
            await page.GetByText("Back to Dashboard").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/dashboard"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task NotFoundPageShows404ForInvalidUrl()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("nav404");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/this-route-does-not-exist-at-all");
            await Assertions.Expect(page.GetByText("404")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText(new Regex("page not found", RegexOptions.IgnoreCase))).ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task DeepLinkToWorldWorksWhenAuthed()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navdeep");
            await RegisterUser(page, username);
            var main = page.GetByRole(AriaRole.Main);
            await Assertions.Expect(main.GetByText("The Distributed Problem").First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await main.GetByText("The Distributed Problem").First.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/worlds/"), new() { Timeout = 10_000 });
            var worldUrl = page.Url;

            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await page.GotoAsync(worldUrl);
            await Assertions.Expect(page.GetByText(new Regex("back to dashboard", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task BrowserBackButtonWorksAfterNavigation()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navhistory");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/profile"));
            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/leaderboard"));
            await page.GoBackAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/profile"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
