using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class ThemePersistenceTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task ThemePersists_AcrossLessonNavigation()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("thmnav");
            await RegisterUser(page, username);

            // Get current theme class
            var initialClass = await page.EvaluateAsync<string>("() => document.documentElement.className");
            var isDark = initialClass?.Contains("dark") == true;

            // Toggle theme
            var themeBtn = page.GetByLabel("Toggle color mode");
            await Assertions.Expect(themeBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await themeBtn.ClickAsync();
            await page.WaitForTimeoutAsync(500);

            // Verify theme changed
            var afterToggleClass = await page.EvaluateAsync<string>("() => document.documentElement.className");
            if (isDark)
            {
                Assert.Contains("light", afterToggleClass!);
            }
            else
            {
                Assert.Contains("dark", afterToggleClass!);
            }

            var bgAfterToggle = await page.EvaluateAsync<string>("() => getComputedStyle(document.body).backgroundColor");

            // Navigate to a lesson
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            // Verify the theme class is still the toggled one
            var lessonClass = await page.EvaluateAsync<string>("() => document.documentElement.className");
            Assert.Equal(afterToggleClass, lessonClass);

            // Verify the background color matches
            var lessonBg = await page.EvaluateAsync<string>("() => getComputedStyle(document.body).backgroundColor");
            Assert.Equal(bgAfterToggle, lessonBg);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ThemePersists_AcrossPageRefresh()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("thmrefresh");
            await RegisterUser(page, username);

            // Get initial background
            var initialBg = await page.EvaluateAsync<string>("() => getComputedStyle(document.body).backgroundColor");

            // Toggle theme
            var themeBtn = page.GetByLabel("Toggle color mode");
            await Assertions.Expect(themeBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await themeBtn.ClickAsync();
            await page.WaitForTimeoutAsync(500);

            // Verify theme changed
            var afterToggleBg = await page.EvaluateAsync<string>("() => getComputedStyle(document.body).backgroundColor");
            Assert.NotEqual(initialBg, afterToggleBg);

            // Also verify localStorage was updated
            var storedMode = await page.EvaluateAsync<string>("() => localStorage.getItem('aspire-color-mode')");
            Assert.NotNull(storedMode);

            // Refresh the page
            await page.ReloadAsync();
            await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Theme should persist after refresh
            var afterRefreshBg = await page.EvaluateAsync<string>("() => getComputedStyle(document.body).backgroundColor");
            Assert.Equal(afterToggleBg, afterRefreshBg);

            // localStorage should still have the same value
            var storedModeAfterRefresh = await page.EvaluateAsync<string>("() => localStorage.getItem('aspire-color-mode')");
            Assert.Equal(storedMode, storedModeAfterRefresh);
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
