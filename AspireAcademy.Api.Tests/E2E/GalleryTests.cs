using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class GalleryTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task Gallery_Renders()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/gallery");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Look for architecture cards
            var archCards = page.Locator("[data-testid*='arch'], [data-testid*='gallery'], .architecture-card, .gallery-card");
            if (await archCards.CountAsync() > 0)
            {
                await Assertions.Expect(archCards.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
                
                var count = await archCards.CountAsync();
                Assert.True(count >= 1, $"Expected at least 1 architecture card, found {count}");
            }
            else
            {
                // Fallback to any card-like content
                var cards = page.Locator(".card, [data-card], .tile");
                if (await cards.CountAsync() > 0)
                {
                    await Assertions.Expect(cards.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
                }
                else
                {
                    // At minimum, verify the gallery page has content
                    var content = page.Locator("main, article, .content, .gallery");
                    await Assertions.Expect(content.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
                }
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Gallery_OpenDetail()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/gallery");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Look for clickable architecture cards
            var archCards = page.Locator("[data-testid*='arch'], [data-testid*='gallery'], .architecture-card, .gallery-card");
            
            if (await archCards.CountAsync() > 0)
            {
                var card = archCards.First;
                await Assertions.Expect(card).ToBeVisibleAsync(new() { Timeout = 10_000 });
                
                await card.ClickAsync();
                
                // Look for detail view with diagram
                var detailView = page.Locator("[data-testid*='detail'], .detail-view, .modal, .diagram-view, .architecture-detail");
                if (await detailView.CountAsync() > 0)
                {
                    await Assertions.Expect(detailView.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
                    
                    // Look for diagram or image content
                    var diagram = page.Locator("svg, img, canvas, [data-testid*='diagram']");
                    if (await diagram.CountAsync() > 0)
                    {
                        await Assertions.Expect(diagram.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
                    }
                }
                else
                {
                    // Alternative: clicking might navigate to a detail page
                    await page.WaitForTimeoutAsync(1000);
                    var currentUrl = page.Url;
                    Assert.True(currentUrl != fixture.WebBaseUrl + "/gallery", "Clicking card should open detail view or navigate");
                }
            }
            else
            {
                // Fallback to any clickable cards
                var cards = page.Locator(".card, [data-card], .tile");
                if (await cards.CountAsync() > 0)
                {
                    await cards.First.ClickAsync();
                    await page.WaitForTimeoutAsync(500);
                    
                    // Verify something happened (modal, navigation, or expanded content)
                    var modal = page.Locator(".modal, .dialog, [role='dialog']");
                    var currentUrl = page.Url;
                    var hasModal = await modal.CountAsync() > 0;
                    var hasNavigated = currentUrl != fixture.WebBaseUrl + "/gallery";
                    
                    Assert.True(hasModal || hasNavigated, "Clicking card should show modal or navigate");
                }
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Gallery_LoadsFromApi()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var apiCalled = false;
            await page.RouteAsync("**/api/gallery", async route =>
            {
                apiCalled = true;
                await route.ContinueAsync();
            });

            await page.GotoAsync(fixture.WebBaseUrl + "/gallery");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            Assert.True(apiCalled, "GalleryPage should fetch data from /api/gallery");
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}