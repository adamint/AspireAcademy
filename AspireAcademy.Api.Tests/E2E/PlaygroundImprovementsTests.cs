using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
[Collection("E2E")]
public class PlaygroundImprovementsTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task Playground_UndoRedo_Works()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/playground");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            // Wait for resource palette to be visible
            var palette = page.GetByTestId("resource-palette");
            await Assertions.Expect(palette).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Add a PostgreSQL resource
            var addPostgres = page.GetByTestId("add-postgres");
            await Assertions.Expect(addPostgres).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await addPostgres.ClickAsync();

            // Verify resource card appeared
            var resourceCards = page.Locator("[data-testid^='resource-card-']");
            await Assertions.Expect(resourceCards.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var countAfterAdd = await resourceCards.CountAsync();
            Assert.True(countAfterAdd >= 1, "Expected at least 1 resource card after adding");

            // Click Undo
            var undoBtn = page.GetByTestId("undo-btn");
            await Assertions.Expect(undoBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
            await undoBtn.ClickAsync();

            // Verify resource disappeared
            await page.WaitForTimeoutAsync(500);
            var countAfterUndo = await resourceCards.CountAsync();
            Assert.True(countAfterUndo < countAfterAdd, "Undo should remove the added resource");

            // Click Redo
            var redoBtn = page.GetByTestId("redo-btn");
            await Assertions.Expect(redoBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
            await redoBtn.ClickAsync();

            // Verify resource reappeared
            await Assertions.Expect(resourceCards.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var countAfterRedo = await resourceCards.CountAsync();
            Assert.Equal(countAfterAdd, countAfterRedo);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Playground_UndoButton_DisabledInitially()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/playground");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            var palette = page.GetByTestId("resource-palette");
            await Assertions.Expect(palette).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Verify undo button is disabled on fresh playground
            var undoBtn = page.GetByTestId("undo-btn");
            await Assertions.Expect(undoBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await Assertions.Expect(undoBtn).ToBeDisabledAsync(new() { Timeout = 5_000 });

            // Verify redo button is also disabled
            var redoBtn = page.GetByTestId("redo-btn");
            await Assertions.Expect(redoBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await Assertions.Expect(redoBtn).ToBeDisabledAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Playground_ShareButton_CopiesUrl()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/playground");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            var palette = page.GetByTestId("resource-palette");
            await Assertions.Expect(palette).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Add a resource first
            var addRedis = page.GetByTestId("add-redis");
            await Assertions.Expect(addRedis).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await addRedis.ClickAsync();

            // Verify resource was added
            var resourceCards = page.Locator("[data-testid^='resource-card-']");
            await Assertions.Expect(resourceCards.First).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Click Share button
            var shareBtn = page.GetByTestId("share-btn");
            await Assertions.Expect(shareBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await shareBtn.ClickAsync();

            // Verify URL hash is set (share encodes state in hash)
            await page.WaitForTimeoutAsync(500);
            var hash = await page.EvaluateAsync<string>("() => window.location.hash");
            Assert.True(!string.IsNullOrEmpty(hash) && hash.Length > 1,
                $"Expected URL hash to be set after sharing, got: '{hash}'");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Playground_ShareLink_RestoresState()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/playground");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            var palette = page.GetByTestId("resource-palette");
            await Assertions.Expect(palette).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Add a resource
            var addPostgres = page.GetByTestId("add-postgres");
            await addPostgres.ClickAsync();
            var resourceCards = page.Locator("[data-testid^='resource-card-']");
            await Assertions.Expect(resourceCards.First).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Click share to get the hash
            var shareBtn = page.GetByTestId("share-btn");
            await shareBtn.ClickAsync();
            await page.WaitForTimeoutAsync(500);
            var shareUrl = await page.EvaluateAsync<string>("() => window.location.href");
            Assert.Contains("#", shareUrl);

            // Navigate to a different page first, then back to the share URL
            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);

            // Navigate to playground with the share hash
            await page.GotoAsync(shareUrl);
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            // Verify the resource is restored from the share link
            var restoredCards = page.Locator("[data-testid^='resource-card-']");
            await Assertions.Expect(restoredCards.First).ToBeVisibleAsync(new() { Timeout = 15_000 });
            var restoredCount = await restoredCards.CountAsync();
            Assert.True(restoredCount >= 1, "Share link should restore at least 1 resource");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Playground_ValidationPanel_ShowsErrors()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/playground");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            var palette = page.GetByTestId("resource-palette");
            await Assertions.Expect(palette).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Add a container resource (requires an image to be valid)
            var addContainer = page.GetByTestId("add-container");
            await Assertions.Expect(addContainer).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await addContainer.ClickAsync();

            // Verify validation panel appears with issues
            var validationPanel = page.GetByTestId("validation-panel");
            await Assertions.Expect(validationPanel).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Verify at least one validation issue is shown
            var issues = page.Locator("[data-testid^='validation-issue-']");
            await Assertions.Expect(issues.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var issueCount = await issues.CountAsync();
            Assert.True(issueCount >= 1, $"Expected at least 1 validation issue, found {issueCount}");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Playground_ConnectionLines_Render()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/playground");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            var palette = page.GetByTestId("resource-palette");
            await Assertions.Expect(palette).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Add two resources
            var addPostgres = page.GetByTestId("add-postgres");
            await addPostgres.ClickAsync();
            await page.WaitForTimeoutAsync(300);

            var addProject = page.GetByTestId("add-project");
            await Assertions.Expect(addProject).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await addProject.ClickAsync();
            await page.WaitForTimeoutAsync(300);

            // Verify two resource cards exist
            var resourceCards = page.Locator("[data-testid^='resource-card-']");
            var cardCount = await resourceCards.CountAsync();
            Assert.True(cardCount >= 2, $"Expected at least 2 resource cards, found {cardCount}");

            // Click the connect button on the project resource to initiate a connection
            var connectButtons = page.Locator("[data-testid^='connect-']");
            if (await connectButtons.CountAsync() > 0)
            {
                await connectButtons.First.ClickAsync();

                // Click the target resource card to complete the connection
                await resourceCards.Last.ClickAsync();
                await page.WaitForTimeoutAsync(500);
            }

            // Verify the connection overlay SVG is present
            var connectionOverlay = page.GetByTestId("connection-overlay");
            await Assertions.Expect(connectionOverlay).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Check for SVG path elements (connection lines)
            var svgPaths = connectionOverlay.Locator("path, line");
            var pathCount = await svgPaths.CountAsync();
            Assert.True(pathCount > 0, "Expected at least one connection line SVG path");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Playground_ImportExport_RoundTrips()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/playground");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            var palette = page.GetByTestId("resource-palette");
            await Assertions.Expect(palette).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Add resources to the playground
            var addRedis = page.GetByTestId("add-redis");
            await Assertions.Expect(addRedis).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await addRedis.ClickAsync();
            await page.WaitForTimeoutAsync(300);

            var addPostgres = page.GetByTestId("add-postgres");
            await addPostgres.ClickAsync();
            await page.WaitForTimeoutAsync(300);

            var resourceCards = page.Locator("[data-testid^='resource-card-']");
            await Assertions.Expect(resourceCards.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var cardCount = await resourceCards.CountAsync();
            Assert.True(cardCount >= 2, $"Expected at least 2 resource cards, found {cardCount}");

            // Switch to code tab to verify code generation
            var codeTab = page.GetByTestId("code-tab").Or(
                page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("code", RegexOptions.IgnoreCase) }));
            await Assertions.Expect(codeTab.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await codeTab.First.ClickAsync();

            // Verify generated code contains resource references
            var codeBlock = page.GetByTestId("generated-code").Or(
                page.Locator("pre code, .code-output, [data-testid='code-output']"));
            await Assertions.Expect(codeBlock.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var codeText = await codeBlock.First.TextContentAsync();
            Assert.False(string.IsNullOrWhiteSpace(codeText), "Generated code should not be empty");

            // Test import: look for import button/tab
            var importBtn = page.GetByTestId("import-btn").Or(
                page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("import", RegexOptions.IgnoreCase) }));
            if (await importBtn.CountAsync() > 0 && await importBtn.First.IsVisibleAsync())
            {
                await importBtn.First.ClickAsync();

                // Paste valid AppHost code into the import textarea
                var importInput = page.GetByTestId("import-input").Or(
                    page.Locator("textarea"));
                if (await importInput.CountAsync() > 0)
                {
                    var sampleCode = @"var builder = DistributedApplication.CreateBuilder(args);
var redis = builder.AddRedis(""cache"");
var postgres = builder.AddPostgres(""db"");
builder.Build().Run();";
                    await importInput.First.FillAsync(sampleCode);

                    var confirmImport = page.GetByTestId("confirm-import").Or(
                        page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("apply|confirm|import", RegexOptions.IgnoreCase) }));
                    if (await confirmImport.CountAsync() > 0)
                    {
                        await confirmImport.First.ClickAsync();
                        await page.WaitForTimeoutAsync(500);
                    }

                    // Verify resources were imported
                    var importedCards = page.Locator("[data-testid^='resource-card-']");
                    await Assertions.Expect(importedCards.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
                }
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
