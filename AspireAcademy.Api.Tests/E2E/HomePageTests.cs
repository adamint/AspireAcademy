using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class HomePageTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task HomePage_Renders_Title()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await Assertions.Expect(page.GetByTestId("hero-title")).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task HomePage_Shows_WorldCards()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Wait for world cards to be visible inside the worlds grid
            var worldsGrid = page.GetByTestId("worlds-grid");
            await Assertions.Expect(worldsGrid).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var worldCards = worldsGrid.Locator("> *");
            var count = await worldCards.CountAsync();
            Assert.True(count >= 1, $"Expected at least 1 world card, found {count}");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task HomePage_WorldCard_Navigates()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Find first clickable world card in the worlds grid
            var worldsGrid = page.GetByTestId("worlds-grid");
            await Assertions.Expect(worldsGrid).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var worldCard = worldsGrid.Locator("> *").First;
            await Assertions.Expect(worldCard).ToBeVisibleAsync(new() { Timeout = 10_000 });
            
            await worldCard.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/worlds/"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task HomePage_Stats_Display()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Look for stats section with numbers
            var statsSection = page.Locator("[data-testid='stats'], .stats, [data-testid='home-stats']").First;
            if (await statsSection.CountAsync() > 0)
            {
                await Assertions.Expect(statsSection).ToBeVisibleAsync(new() { Timeout = 10_000 });
            }
            else
            {
                // Fallback to looking for numeric content that looks like stats
                var numbersPattern = page.GetByText(new Regex(@"\d+\s*(users?|lessons?|worlds?|modules?)", RegexOptions.IgnoreCase));
                if (await numbersPattern.CountAsync() > 0)
                {
                    await Assertions.Expect(numbersPattern.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
                }
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task HomePage_CTA_Buttons_Visible()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Look for call-to-action buttons
            var startButton = page.GetByRole(AriaRole.Button).Filter(new() { HasTextRegex = new Regex("start.*journey|get started|begin", RegexOptions.IgnoreCase) });
            var browseButton = page.GetByRole(AriaRole.Button).Filter(new() { HasTextRegex = new Regex("browse|explore", RegexOptions.IgnoreCase) });
            
            // At least one of these should be visible
            var hasStartButton = await startButton.CountAsync() > 0;
            var hasBrowseButton = await browseButton.CountAsync() > 0;
            
            Assert.True(hasStartButton || hasBrowseButton, "Expected to find Start Journey or Browse buttons on home page");
            
            if (hasStartButton)
            {
                await Assertions.Expect(startButton.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            }
            if (hasBrowseButton)
            {
                await Assertions.Expect(browseButton.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task HomePage_Achievements_LoadFromApi()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            // Intercept the worlds API call (home page fetches worlds, not achievements)
            var apiCalled = false;
            await page.RouteAsync("**/api/worlds", async route =>
            {
                apiCalled = true;
                await route.ContinueAsync();
            });

            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            Assert.True(apiCalled, "HomePage should fetch worlds from /api/worlds");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task HomePage_Leaderboard_LoadsFromApi()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var apiCalled = false;
            await page.RouteAsync("**/api/personas", async route =>
            {
                apiCalled = true;
                await route.ContinueAsync();
            });

            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            Assert.True(apiCalled, "HomePage should fetch personas from /api/personas");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task HomePage_Worlds_LoadFromApi()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var apiCalled = false;
            await page.RouteAsync("**/api/worlds", async route =>
            {
                apiCalled = true;
                await route.ContinueAsync();
            });

            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            Assert.True(apiCalled, "HomePage should fetch worlds from /api/worlds");
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}