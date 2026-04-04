using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
[Collection("E2E")]
public class ConceptMapImprovementsTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task ConceptMap_EmptySearch_ShowsMessage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("cmempty");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/concept-map");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            // Wait for concept cards to load first
            var conceptCards = page.Locator("[data-testid^='concept-card-']");
            await Assertions.Expect(conceptCards.First).ToBeVisibleAsync(new() { Timeout = 15_000 });

            // Type a nonsense search term
            var searchInput = page.GetByLabel(new Regex("search.*concepts", RegexOptions.IgnoreCase));
            await Assertions.Expect(searchInput).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await searchInput.FillAsync("zzzzxyznonexistent");
            await page.WaitForTimeoutAsync(500);

            // Verify "No concepts match" empty state appears
            var emptyState = page.GetByTestId("empty-search-state");
            await Assertions.Expect(emptyState).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Verify the message contains the search term
            await Assertions.Expect(emptyState).ToContainTextAsync("No concepts match", new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ConceptMap_EmptySearch_ClearButton_Works()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("cmclear");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/concept-map");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            // Wait for concept cards to load
            var conceptCards = page.Locator("[data-testid^='concept-card-']");
            await Assertions.Expect(conceptCards.First).ToBeVisibleAsync(new() { Timeout = 15_000 });
            var countBefore = await conceptCards.CountAsync();

            // Type a nonsense search to trigger empty state
            var searchInput = page.GetByLabel(new Regex("search.*concepts", RegexOptions.IgnoreCase));
            await searchInput.FillAsync("zzzzxyznonexistent");
            await page.WaitForTimeoutAsync(500);

            var emptyState = page.GetByTestId("empty-search-state");
            await Assertions.Expect(emptyState).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Click "Clear search" button
            var clearButton = page.GetByTestId("clear-search-button");
            await Assertions.Expect(clearButton).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await clearButton.ClickAsync();

            // Verify concepts reappear
            await Assertions.Expect(conceptCards.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var countAfter = await conceptCards.CountAsync();
            Assert.True(countAfter >= countBefore, "Clearing search should restore all concept cards");

            // Verify empty state is gone
            await Assertions.Expect(emptyState).Not.ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ConceptMap_SuggestedNext_NotShownWhenLoggedOut()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            // Clear any existing auth to ensure logged-out state
            await ClearAuth(page);

            await page.GotoAsync(fixture.WebBaseUrl + "/concept-map");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            // Wait for page content to load
            await page.WaitForTimeoutAsync(2000);

            // Verify "Suggested Next" section is NOT shown when logged out
            var suggestedNext = page.GetByTestId("suggested-next-section");
            await Assertions.Expect(suggestedNext).Not.ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
