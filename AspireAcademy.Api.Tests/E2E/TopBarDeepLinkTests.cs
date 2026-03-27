using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class TopBarDeepLinkTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task UserMenuShowsProfileAndLogoutOptions()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("topbar");
            await RegisterUser(page, username);
            var menuBtn = page.GetByLabel("User menu");
            await Assertions.Expect(menuBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await menuBtn.ClickAsync();
            await page.WaitForTimeoutAsync(500);

            var logOutBtn = page.Locator("button").Filter(new() { HasText = "Log Out" });
            await Assertions.Expect(logOutBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task UserMenuProfileNavigatesToProfile()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("topbarprof");
            await RegisterUser(page, username);
            await page.GetByLabel("User menu").ClickAsync();
            await page.WaitForTimeoutAsync(500);

            var profileBtn = page.Locator("button").Filter(new() { HasText = "Profile" });
            await Assertions.Expect(profileBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await profileBtn.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/profile"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task UserMenuLogOutNavigatesToLogin()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("topbarlogout");
            await RegisterUser(page, username);
            await page.GetByLabel("User menu").ClickAsync();
            await page.WaitForTimeoutAsync(500);
            await page.Locator("button").Filter(new() { HasText = "Log Out" }).ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task XpProgressBarIsVisibleInTopBar()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("topbarxp");
            await RegisterUser(page, username);
            var xpBar = page.Locator(".xp-bar-track");
            await Assertions.Expect(xpBar).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task DirectWorldUrlWorksWhenAuthenticated()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("deepworld");
            await RegisterUser(page, username);
            await page.GetByRole(AriaRole.Main).GetByText("Aspire Foundations").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/worlds/"), new() { Timeout = 10_000 });
            var worldUrl = page.Url;

            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await page.GotoAsync(worldUrl);
            await Assertions.Expect(page.GetByText(new Regex("back to dashboard", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task DirectLessonUrlWorksWhenAuthenticated()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("deeplesson");
            await RegisterUser(page, username);
            await page.GetByRole(AriaRole.Main).GetByText("Aspire Foundations").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/worlds/"), new() { Timeout = 10_000 });

            var learnLesson = page.Locator("[role='button']").Filter(new() { HasText = "📖" });
            await Assertions.Expect(learnLesson.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await learnLesson.First.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/lessons/"), new() { Timeout = 10_000 });
            var lessonUrl = page.Url;

            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await page.GotoAsync(lessonUrl);
            await Assertions.Expect(page.GetByText(new Regex("back to", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task BrowserBackButtonWorksAfterNavigation()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("deepback");
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
