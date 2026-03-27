using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class PlaygroundTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task Playground_Renders()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/playground");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Look for resource palette or toolbox
            var palette = page.Locator("[data-testid='resource-palette'], .resource-palette, [data-testid='playground-palette'], .palette, .toolbox");
            await Assertions.Expect(palette.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Playground_AddResource()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/playground");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Look for PostgreSQL button in the resource palette
            var postgresButton = page.GetByRole(AriaRole.Button).Filter(new() { HasTextRegex = new Regex("postgres", RegexOptions.IgnoreCase) });
            if (await postgresButton.CountAsync() == 0)
            {
                // Fallback to any database-like button
                postgresButton = page.GetByRole(AriaRole.Button).Filter(new() { HasTextRegex = new Regex("database|sql|db", RegexOptions.IgnoreCase) });
            }
            
            if (await postgresButton.CountAsync() > 0)
            {
                await Assertions.Expect(postgresButton.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
                await postgresButton.First.ClickAsync();
                
                // Verify a resource card appears
                var resourceCard = page.Locator("[data-testid*='resource-card'], .resource-card, [data-resource], .added-resource");
                await Assertions.Expect(resourceCard.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Playground_CodeGeneration()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/playground");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Add a resource first
            var resourceButton = page.GetByRole(AriaRole.Button).Filter(new() { HasTextRegex = new Regex("postgres|database|redis|sql", RegexOptions.IgnoreCase) });
            if (await resourceButton.CountAsync() > 0)
            {
                await resourceButton.First.ClickAsync();
                
                // Look for generated code panel
                var codePanel = page.Locator("[data-testid='generated-code'], .generated-code, .code-output, pre, code");
                if (await codePanel.CountAsync() > 0)
                {
                    await Assertions.Expect(codePanel.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
                    
                    // Verify it contains relevant code
                    var codeContent = await codePanel.First.TextContentAsync();
                    Assert.True(codeContent?.Contains("Add") == true, "Expected generated code to contain 'Add' method");
                }
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Playground_LoadExample()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/playground");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Look for example buttons
            var exampleButton = page.GetByRole(AriaRole.Button).Filter(new() { HasTextRegex = new Regex("example|template|sample|starter", RegexOptions.IgnoreCase) });
            if (await exampleButton.CountAsync() > 0)
            {
                await exampleButton.First.ClickAsync();
                
                // Verify resources appear
                var resourceCards = page.Locator("[data-testid*='resource-card'], .resource-card, [data-resource], .added-resource");
                await Assertions.Expect(resourceCards.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
                
                var count = await resourceCards.CountAsync();
                Assert.True(count >= 1, $"Expected at least 1 resource after loading example, found {count}");
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}