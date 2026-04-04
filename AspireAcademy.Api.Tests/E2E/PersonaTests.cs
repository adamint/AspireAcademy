using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
[Collection("E2E")]
public class PersonaTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task PersonaHub_RendersPersonaCards()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/personas");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            // Verify persona cards render with names
            var personaCards = page.Locator("[data-testid^='persona-card-']").Or(
                page.Locator(".persona-card"));
            await Assertions.Expect(personaCards.First).ToBeVisibleAsync(new() { Timeout = 15_000 });

            var cardCount = await personaCards.CountAsync();
            Assert.True(cardCount >= 1, $"Expected at least 1 persona card, found {cardCount}");

            // Verify cards have text content (persona names)
            var firstCardText = await personaCards.First.TextContentAsync();
            Assert.False(string.IsNullOrWhiteSpace(firstCardText), "Persona card should have a name");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task PersonaDetail_ShowsPersonaInfo()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            // First load the hub to find a valid persona link
            await page.GotoAsync(fixture.WebBaseUrl + "/personas");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            var personaCards = page.Locator("[data-testid^='persona-card-']").Or(
                page.Locator(".persona-card"));
            await Assertions.Expect(personaCards.First).ToBeVisibleAsync(new() { Timeout = 15_000 });

            // Find and extract the first persona link href, or click into the card
            var personaLink = personaCards.First.Locator("a[href*='/personas/']");
            var linkCount = await personaLink.CountAsync();

            if (linkCount > 0)
            {
                await personaLink.First.ClickAsync();
            }
            else
            {
                // Card itself may be clickable
                await personaCards.First.ClickAsync();
            }

            // Verify we navigated to a persona detail page
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/personas/"), new() { Timeout = 10_000 });
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            // Verify detail content loaded — look for a heading or persona name
            var heading = page.GetByRole(AriaRole.Heading);
            await Assertions.Expect(heading.First).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var headingText = await heading.First.TextContentAsync();
            Assert.False(string.IsNullOrWhiteSpace(headingText), "Persona detail should display a heading with the persona name");
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
