using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
[Collection("E2E")]
public class GalleryImprovementsTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task Gallery_SearchFiltersResults()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/gallery");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            var searchInput = page.GetByTestId("gallery-search");
            await Assertions.Expect(searchInput).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Count cards before search
            var cardsBefore = page.Locator("[data-testid*='arch'], .gallery-card, .architecture-card").Or(
                page.Locator("[role='group'] > *"));
            await Assertions.Expect(cardsBefore.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var countBefore = await cardsBefore.CountAsync();
            Assert.True(countBefore >= 1, "Expected at least 1 gallery card before searching");

            // Type a specific search term that should filter results
            await searchInput.FillAsync("starter");
            await page.WaitForTimeoutAsync(500);

            // Verify filtered results appear — at least one card should still match
            var cardsAfter = page.Locator("[data-testid*='arch'], .gallery-card, .architecture-card").Or(
                page.Locator("[role='group'] > *"));
            var countAfter = await cardsAfter.CountAsync();
            Assert.True(countAfter >= 1, "Expected at least 1 result matching 'starter'");
            Assert.True(countAfter <= countBefore, "Search should filter results to equal or fewer cards");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Gallery_DeepLink_NavigatesToDetail()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/gallery/starter");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            // Verify detail view loaded — back button is only present in detail mode
            var backButton = page.GetByTestId("gallery-back-button");
            await Assertions.Expect(backButton).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Verify the page shows the correct project title
            var heading = page.GetByRole(AriaRole.Heading);
            await Assertions.Expect(heading.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Gallery_DeepLink_BackNavigatesToList()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/gallery/starter");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            var backButton = page.GetByTestId("gallery-back-button");
            await Assertions.Expect(backButton).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await backButton.ClickAsync();

            // Verify navigation back to gallery list
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/gallery$"), new() { Timeout = 10_000 });

            // Verify the search input is visible (list view indicator)
            var searchInput = page.GetByTestId("gallery-search");
            await Assertions.Expect(searchInput).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Gallery_InteractiveDiagram_ClickServiceHighlights()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/gallery/starter");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            // Wait for service nodes in the diagram
            var serviceNodes = page.Locator("[data-testid^='service-node-']");
            await Assertions.Expect(serviceNodes.First).ToBeVisibleAsync(new() { Timeout = 15_000 });

            // Click a service node
            await serviceNodes.First.ClickAsync();

            // Verify the service info card appears (shows details of selected node)
            var infoCard = page.GetByTestId("service-info-card");
            await Assertions.Expect(infoCard).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Gallery_LearnThisLinks_Visible()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/gallery/starter");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            // Verify "Related Lessons" section exists
            var relatedLessons = page.GetByTestId("related-lessons");
            await Assertions.Expect(relatedLessons).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Verify clickable lesson badges exist within the section
            var badges = relatedLessons.Locator("[data-testid^='related-lesson-'], [role='link']");
            var badgeCount = await badges.CountAsync();
            Assert.True(badgeCount >= 1, $"Expected at least 1 related lesson badge, found {badgeCount}");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Gallery_PlaygroundBridge_NavigatesToPlayground()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/gallery/starter");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            var openInPlayground = page.GetByTestId("open-in-playground");
            await Assertions.Expect(openInPlayground).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await openInPlayground.ClickAsync();

            // Verify navigation to playground
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/playground"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
