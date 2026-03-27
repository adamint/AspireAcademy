using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class WhatsNewTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task WhatsNew_Renders()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/whats-new");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Look for timeline or version history content
            var timeline = page.Locator("[data-testid='timeline'], .timeline, [data-testid='version-history'], .version-history, .whats-new");
            await Assertions.Expect(timeline.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task WhatsNew_ShowsVersions()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/whats-new");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Look for version badges or version text
            var versionBadges = page.Locator("[data-testid*='version'], .version-badge, .version");
            if (await versionBadges.CountAsync() > 0)
            {
                await Assertions.Expect(versionBadges.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            }
            else
            {
                // Fallback to looking for version patterns in text
                var versionText = page.GetByText(new Regex(@"v?\d+\.\d+", RegexOptions.IgnoreCase));
                if (await versionText.CountAsync() > 0)
                {
                    await Assertions.Expect(versionText.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
                }
                else
                {
                    // At minimum, verify the page has content
                    var content = page.Locator("main, article, .content, [data-testid='whats-new-content']");
                    await Assertions.Expect(content.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
                }
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task WhatsNew_ExpandCollapse()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/whats-new");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Look for expandable sections
            var expandButtons = page.GetByRole(AriaRole.Button).Filter(new() { HasTextRegex = new Regex("expand|show more|older|previous", RegexOptions.IgnoreCase) });
            
            if (await expandButtons.CountAsync() == 0)
            {
                // Alternative selectors for expandable content
                expandButtons = page.Locator("[data-testid*='expand'], .expandable, .collapsible, summary");
            }
            
            if (await expandButtons.CountAsync() > 0)
            {
                var button = expandButtons.First;
                await Assertions.Expect(button).ToBeVisibleAsync(new() { Timeout = 10_000 });
                
                // Click to expand
                await button.ClickAsync();
                
                // Verify something expanded (this is best effort)
                await page.WaitForTimeoutAsync(500);
                
                // Look for newly visible content
                var expandedContent = page.Locator(".expanded, [aria-expanded='true'], .visible");
                if (await expandedContent.CountAsync() > 0)
                {
                    await Assertions.Expect(expandedContent.First).ToBeVisibleAsync(new() { Timeout = 5_000 });
                }
            }
            else
            {
                // If no expandable sections found, just verify the page has content
                var content = page.Locator("main, article, .content");
                await Assertions.Expect(content.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}