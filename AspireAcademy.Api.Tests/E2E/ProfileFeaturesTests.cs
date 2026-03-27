using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class ProfileFeaturesTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task Profile_ShowsHeatmap()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("heatmap");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            
            // Verify activity heatmap section visible on profile
            var heatmap = page.GetByText(new Regex("activity.*heatmap|heatmap|activity.*calendar", RegexOptions.IgnoreCase))
                .Or(page.Locator("[data-testid*='heatmap'], .heatmap, .activity-chart"));
            await Assertions.Expect(heatmap.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Profile_ShowsSkillRadar()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("radar");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            
            // Verify skill radar SVG renders on profile
            var radar = page.GetByText(new Regex("skill.*radar|skills?.*chart", RegexOptions.IgnoreCase))
                .Or(page.Locator("svg").Filter(new() { HasTextRegex = new Regex("skill|radar", RegexOptions.IgnoreCase) }))
                .Or(page.Locator("[data-testid*='radar'], .skill-radar"));
            await Assertions.Expect(radar.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Profile_ShowsGitHubField()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("github");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            
            // Open edit profile dialog
            var editBtn = page.Locator("button").Filter(new() { HasTextRegex = new Regex("edit profile", RegexOptions.IgnoreCase) });
            await Assertions.Expect(editBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await editBtn.ClickAsync();
            
            var dialog = page.Locator("[role='dialog']");
            await Assertions.Expect(dialog).ToBeVisibleAsync(new() { Timeout = 5_000 });
            
            // Verify GitHub username field exists in edit mode
            var githubField = dialog.GetByText("GitHub")
                .Or(dialog.Locator("input[name*='github'], input[placeholder*='github']"));
            await Assertions.Expect(githubField.First).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}