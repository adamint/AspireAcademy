using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class NavigationDepthTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task SidebarClickWorld_ModulesAppear()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navworld2");
            await RegisterUser(page, username);
            var sidebar = page.GetByRole(AriaRole.Navigation);
            await Assertions.Expect(sidebar.GetByText("Aspire Foundations")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await sidebar.GetByText("Aspire Foundations").ClickAsync();
            await Assertions.Expect(sidebar.GetByText("Why Aspire?")).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SidebarClickModule_NavigatesToWorldPage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navmod2");
            await RegisterUser(page, username);
            var sidebar = page.GetByRole(AriaRole.Navigation);
            await Assertions.Expect(sidebar.GetByText("Aspire Foundations")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await sidebar.GetByText("Aspire Foundations").ClickAsync();
            await Assertions.Expect(sidebar.GetByText("Why Aspire?")).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await sidebar.GetByText("Why Aspire?").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/worlds/"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task DeepLinkLessonAuthenticated_ShowsLesson()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navdeep2");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/lessons/1.1.1");
            await Assertions.Expect(page.GetByText(new Regex("back to", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/lessons/1\\.1\\.1"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task DeepLinkLessonUnauthenticated_RedirectsToLogin()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/lessons/1.1.1");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task BrowserBackButtonWorks()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navback2");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/profile"));
            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/leaderboard"));
            await page.GoBackAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/profile"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task InvalidLessonUrl_ShowsError()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("naverr2");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/lessons/nonexistent");
            await Assertions.Expect(page.GetByText(new Regex("lesson not found|not found|error", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ThemeToggle_PageColorsChange()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navtheme2");
            await RegisterUser(page, username);
            var themeBtn = page.GetByLabel("Toggle color mode");
            await Assertions.Expect(themeBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var initialBg = await page.EvaluateAsync<string>("() => getComputedStyle(document.body).backgroundColor");
            await themeBtn.ClickAsync();
            await page.WaitForTimeoutAsync(500);
            var newBg = await page.EvaluateAsync<string>("() => getComputedStyle(document.body).backgroundColor");
            Assert.NotEqual(initialBg, newBg);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ThemePersistsOnRefresh()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("navthemep2");
            await RegisterUser(page, username);
            var themeBtn = page.GetByLabel("Toggle color mode");
            await Assertions.Expect(themeBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var beforeBg = await page.EvaluateAsync<string>("() => getComputedStyle(document.body).backgroundColor");
            await themeBtn.ClickAsync();
            await page.WaitForTimeoutAsync(500);
            var afterBg = await page.EvaluateAsync<string>("() => getComputedStyle(document.body).backgroundColor");
            Assert.NotEqual(beforeBg, afterBg);

            await page.ReloadAsync();
            await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var refreshBg = await page.EvaluateAsync<string>("() => getComputedStyle(document.body).backgroundColor");
            Assert.Equal(afterBg, refreshBg);
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
