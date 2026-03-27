using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class ThemeTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task ThemeToggleButtonIsVisible()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("theme");
            await RegisterUser(page, username);
            var themeBtn = page.GetByLabel("Toggle color mode");
            await Assertions.Expect(themeBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickingThemeToggleSwitchesTheme()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("themetoggle");
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
    public async Task ThemePersistsAfterPageRefresh()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("themepersist");
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
