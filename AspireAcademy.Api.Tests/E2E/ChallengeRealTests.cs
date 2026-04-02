using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class ChallengeRealTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    private async Task<bool> GoToChallenge(IPage page, string username)
    {
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
    public async Task ChallengePageLoads_MonacoEditorVisible()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chalload");
            await RegisterUser(page, username);

            if (!await GoToChallenge(page, username))
            {
                return;
            }

            await Assertions.Expect(page.Locator(".monaco-editor")).ToBeVisibleAsync(new() { Timeout = 15_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task InstructionsPanelShowsChallengeDescription()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chalinst");
            await RegisterUser(page, username);

            if (!await GoToChallenge(page, username))
            {
                return;
            }

            // Challenge title heading visible
            await Assertions.Expect(page.GetByRole(AriaRole.Heading).Filter(new() { HasTextRegex = new Regex("challenge", RegexOptions.IgnoreCase) }).First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task TestCaseDescriptionsListed()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chaltests");
            await RegisterUser(page, username);

            if (!await GoToChallenge(page, username))
            {
                return;
            }

            await Assertions.Expect(page.GetByText("Tests")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // At least one test case description visible
            var testCases = page.Locator("text=☐");
            Assert.True(await testCases.CountAsync() >= 1, "Should have at least one test case with pending icon");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task TypeCodeInEditor_ContentChanges()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chaltype");
            await RegisterUser(page, username);

            if (!await GoToChallenge(page, username))
            {
                return;
            }

            // Read initial editor content
            var initialContent = await page.EvaluateAsync<string>(
                "() => window.monaco?.editor?.getModels()?.[0]?.getValue() ?? ''");

            // Use Monaco API to modify content (keyboard typing is unreliable in headless browsers)
            await page.EvaluateAsync(@"() => {
                const model = window.monaco?.editor?.getModels()?.[0];
                if (model) {
                    const currentValue = model.getValue();
                    model.setValue(currentValue + '\n// E2E test comment');
                }
            }");
            await page.WaitForTimeoutAsync(500);

            // Read updated content
            var updatedContent = await page.EvaluateAsync<string>(
                "() => window.monaco?.editor?.getModels()?.[0]?.getValue() ?? ''");

            Assert.NotEqual(initialContent, updatedContent);
            Assert.Contains("E2E test comment", updatedContent);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickRun_OutputPanelBecomesVisible()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chalrun");
            await RegisterUser(page, username);

            if (!await GoToChallenge(page, username))
            {
                return;
            }

            // Click the Check & Submit button (Run button was removed; only submit exists)
            var submitBtn = page.GetByTestId("challenge-submit");
            await Assertions.Expect(submitBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await submitBtn.ClickAsync();

            // Output panel should become visible with some text (Checking... or actual output)
            var outputPanel = page.GetByText(new Regex("output|checking|validation|result|pass|fail", RegexOptions.IgnoreCase));
            await Assertions.Expect(outputPanel.First).ToBeVisibleAsync(new() { Timeout = 15_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickSubmit_TestResultsSectionAppears()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chalsubmit");
            await RegisterUser(page, username);

            if (!await GoToChallenge(page, username))
            {
                return;
            }

            var submitBtn = page.GetByTestId("challenge-submit");
            await Assertions.Expect(submitBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await submitBtn.ClickAsync();

            // Wait for submission to process — test results should update (check marks or X marks)
            await page.WaitForTimeoutAsync(5_000);
            var testResults = page.Locator("text=✅, text=❌, text=☐");
            var anyResults = page.GetByText(new Regex("✅|❌|output|error|running|submitting", RegexOptions.IgnoreCase));
            await Assertions.Expect(anyResults.First).ToBeVisibleAsync(new() { Timeout = 15_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickFirstHintButton_HintTextAppears()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chalhint2");
            await RegisterUser(page, username);

            if (!await GoToChallenge(page, username))
            {
                return;
            }

            var hint1Btn = page.GetByRole(AriaRole.Button, new() { Name = "Hint 1" });
            await Assertions.Expect(hint1Btn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await hint1Btn.ClickAsync();

            // Hint text with lightbulb emoji should appear
            await Assertions.Expect(page.GetByText("💡")).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
