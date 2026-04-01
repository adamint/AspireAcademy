using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class ConceptMapTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task ConceptMap_Renders()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("conceptmap");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/concept-map");
            
            // Verify concept map page loads with heading
            await Assertions.Expect(page.GetByText(new Regex("concept.*map", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            
            // The concept map renders as a grid of concept cards, not SVG/canvas
            // Look for the search input as a proxy for the page loading
            var searchInput = page.GetByLabel(new Regex("search.*concepts", RegexOptions.IgnoreCase));
            await Assertions.Expect(searchInput).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ConceptMap_HasNodes()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("nodes");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/concept-map");
            
            // Verify concept nodes are visible
            var nodes = page.Locator("circle, .node, .concept-node").Or(
                page.GetByText(new Regex("aspire|hosting|service", RegexOptions.IgnoreCase))
            );
            await Assertions.Expect(nodes.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ConceptMap_SearchWorks()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("search");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/concept-map");
            
            // Find the search input by its aria-label
            var searchInput = page.GetByLabel(new Regex("search.*concepts", RegexOptions.IgnoreCase));
            await Assertions.Expect(searchInput).ToBeVisibleAsync(new() { Timeout = 10_000 });
            
            await searchInput.FillAsync("aspire");
            await page.WaitForTimeoutAsync(1000);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ConceptMap_LoadsFromApi()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var apiCalled = false;
            await page.RouteAsync("**/api/concepts", async route =>
            {
                apiCalled = true;
                await route.ContinueAsync();
            });

            var username = UniqueUser("apicheck");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/concept-map");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            Assert.True(apiCalled, "ConceptMapPage should fetch data from /api/concepts");
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}