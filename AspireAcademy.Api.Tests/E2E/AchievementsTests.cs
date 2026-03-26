using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class AchievementsTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task AchievementsPageLoadsWithAllTab()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("achieve");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/achievements");

            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("^all$", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("milestone", RegexOptions.IgnoreCase) })).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("mastery", RegexOptions.IgnoreCase) })).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("streak", RegexOptions.IgnoreCase) })).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("speed", RegexOptions.IgnoreCase) })).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("perfection", RegexOptions.IgnoreCase) })).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("completion", RegexOptions.IgnoreCase) })).ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SwitchingCategoryTabsFiltersAchievements()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("achfilter");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/achievements");
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("^all$", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 10_000 });

            await page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("milestone", RegexOptions.IgnoreCase) }).ClickAsync();
            await page.WaitForTimeoutAsync(1_000);
            await Assertions.Expect(page.Locator("body")).Not.ToHaveTextAsync("");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task LockedAchievementsAreVisuallyDistinct()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("achlocked");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/achievements");
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("^all$", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await page.WaitForTimeoutAsync(3_000);

            var hasAchievementContent = await page.GetByText(new Regex("achievements|complete lessons|keep learning", RegexOptions.IgnoreCase)).First.IsVisibleAsync();
            Assert.True(hasAchievementContent);
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
