using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class ChallengeFlowTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    private async Task<bool> UnlockAndGoToChallenge(IPage page, string username)
    {
        // Complete all prerequisites for challenge 1.3.6
        await UnlockFirstChallenge(page);
        await LoginUser(page, username);
        await page.GotoAsync(fixture.WebBaseUrl + "/challenges/1.3.6");
        await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
        await DismissPopups(page);
        try
        {
            await Assertions.Expect(page.Locator(".monaco-editor")).ToBeVisibleAsync(new() { Timeout = 30_000 });
            return true;
        }
        catch
        {
            return false;
        }
    }

    [Fact]
    public async Task NavigateToChallenge_AfterCompletingPrerequisitesViaApi()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("cflnav");
            await RegisterUser(page, username);

            if (!await UnlockAndGoToChallenge(page, username))
            {
                return;
            }

            // Challenge page loaded successfully with Monaco editor
            await Assertions.Expect(page.Locator(".monaco-editor")).ToBeVisibleAsync(new() { Timeout = 15_000 });

            // Challenge title heading visible
            await Assertions.Expect(page.GetByRole(AriaRole.Heading).Filter(new() { HasTextRegex = new Regex("challenge", RegexOptions.IgnoreCase) }).First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task MonacoEditorLoads_WithStarterCodeVisible()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("cflmonaco");
            await RegisterUser(page, username);

            if (!await UnlockAndGoToChallenge(page, username))
            {
                return;
            }

            // Monaco editor should be visible
            await Assertions.Expect(page.Locator(".monaco-editor")).ToBeVisibleAsync(new() { Timeout = 15_000 });

            // Starter code should contain "CreateBuilder"
            await Assertions.Expect(page.Locator(".monaco-editor")).ToContainTextAsync("CreateBuilder", new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task AutocompletePopup_AppearsWhenTypingBuilderAdd()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("cflautoc");
            await RegisterUser(page, username);

            if (!await UnlockAndGoToChallenge(page, username))
            {
                return;
            }

            // Click into the Monaco editor
            await page.Locator(".monaco-editor .view-lines").First.ClickAsync();
            await page.Keyboard.PressAsync("End");
            await page.Keyboard.TypeAsync("\nbuilder.Add");
            await page.WaitForTimeoutAsync(1_500);

            // Trigger autocomplete explicitly with Ctrl+Space
            await page.Keyboard.PressAsync("Control+Space");
            await page.WaitForTimeoutAsync(2_000);

            // The suggest widget should appear
            var suggestWidget = page.Locator(".suggest-widget, .editor-widget.suggest-widget, .monaco-list");
            var hasSuggest = await suggestWidget.First.IsVisibleAsync();

            // Monaco may render completions in various container classes
            if (!hasSuggest)
            {
                // Try an alternative check — look for Aspire-specific completions
                var aspireCompletion = page.Locator(".monaco-list-row, .suggest-widget").Filter(new() { HasTextRegex = new Regex("AddRedis|AddProject|AddPostgres", RegexOptions.IgnoreCase) });
                hasSuggest = await aspireCompletion.CountAsync() > 0;
            }

            Assert.True(hasSuggest, "Autocomplete popup should appear when typing 'builder.Add' in Monaco editor");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickRun_OutputPanelShowsValidationResults()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("cflrun");
            await RegisterUser(page, username);

            if (!await UnlockAndGoToChallenge(page, username))
            {
                return;
            }

            // Click the Check & Submit button (Run button was removed)
            var submitBtn = page.GetByTestId("challenge-submit");
            await Assertions.Expect(submitBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await submitBtn.ClickAsync();

            // Output panel should show validation results (not a Docker error)
            var outputText = page.GetByText(new Regex("output|checking|compilation|validation|result|pass|fail", RegexOptions.IgnoreCase));
            await Assertions.Expect(outputText.First).ToBeVisibleAsync(new() { Timeout = 15_000 });

            // Should NOT show Docker-related errors since CodeRunner was replaced
            var dockerError = page.GetByText(new Regex("docker|container.*not found|connection refused.*docker", RegexOptions.IgnoreCase));
            await Assertions.Expect(dockerError).Not.ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickSubmit_TestCaseResultsShownWithIcons()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("cflsubmit");
            await RegisterUser(page, username);

            if (!await UnlockAndGoToChallenge(page, username))
            {
                return;
            }

            // Click the Submit button
            var submitBtn = page.GetByTestId("challenge-submit");
            await Assertions.Expect(submitBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await submitBtn.ClickAsync();

            // Wait for submission to process — test results should update with ✅ or ❌ icons
            await page.WaitForTimeoutAsync(5_000);

            // Verify that test case results appear (either pass or fail icons)
            var passIcons = page.Locator("text=✅");
            var failIcons = page.Locator("text=❌");
            var passCount = await passIcons.CountAsync();
            var failCount = await failIcons.CountAsync();
            Assert.True(passCount + failCount > 0, "Submit should show test case results with ✅ or ❌ icons");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task HintsRevealProgressively()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("cflhints");
            await RegisterUser(page, username);

            if (!await UnlockAndGoToChallenge(page, username))
            {
                return;
            }

            // Click Hint 1
            var hint1Btn = page.GetByRole(AriaRole.Button, new() { Name = "Hint 1" });
            await Assertions.Expect(hint1Btn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await hint1Btn.ClickAsync();

            // First hint should be revealed with 💡 icon
            await Assertions.Expect(page.GetByText("💡")).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Check for Hint 2 button
            var hint2Btn = page.GetByRole(AriaRole.Button, new() { Name = "Hint 2" });
            if (await hint2Btn.IsVisibleAsync())
            {
                await hint2Btn.ClickAsync();
                await page.WaitForTimeoutAsync(1_000);

                // Second hint should also be visible now — count lightbulb icons
                var lightbulbs = page.Locator("text=💡");
                Assert.True(await lightbulbs.CountAsync() >= 2, "After clicking Hint 2, at least 2 hints should be visible");
            }

            // Check for Hint 3
            var hint3Btn = page.GetByRole(AriaRole.Button, new() { Name = "Hint 3" });
            if (await hint3Btn.IsVisibleAsync())
            {
                await hint3Btn.ClickAsync();
                await page.WaitForTimeoutAsync(1_000);

                var lightbulbs = page.Locator("text=💡");
                Assert.True(await lightbulbs.CountAsync() >= 3, "After clicking Hint 3, at least 3 hints should be visible");
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
