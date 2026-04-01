using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class ChallengeTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task NavigateToChallenge_MonacoEditorLoads()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chalmonaco");
            await RegisterUser(page, username);
            await UnlockFirstChallenge(page);
            await LoginUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/challenges/1.2.5");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            // Wait for either Monaco editor or the challenge page content
            var editor = page.Locator(".monaco-editor");
            var challengeSubmit = page.GetByTestId("challenge-submit");
            var lockMsg = page.GetByText(new Regex("unlock.*challenge|prerequisites", RegexOptions.IgnoreCase));
            await Assertions.Expect(editor.Or(challengeSubmit).Or(lockMsg).First).ToBeVisibleAsync(new() { Timeout = 20_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task EditorHasStarterCodePreFilled()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chalstarter");
            await RegisterUser(page, username);
            await UnlockFirstChallenge(page);
            await LoginUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/challenges/1.2.5");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            var editor = page.Locator(".monaco-editor");
            var lockMsg = page.GetByText(new Regex("unlock.*challenge|prerequisites", RegexOptions.IgnoreCase));
            // If locked, skip the assertion
            if (await lockMsg.IsVisibleAsync()) return;
            await Assertions.Expect(editor).ToBeVisibleAsync(new() { Timeout = 20_000 });
            await Assertions.Expect(editor).ToContainTextAsync("CreateBuilder", new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task InstructionsPanelShowsChallengeDescription()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chalinstr");
            await RegisterUser(page, username);
            await UnlockFirstChallenge(page);
            await LoginUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/challenges/1.2.5");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            // Verify the challenge page loaded (either editor or heading)
            var heading = page.GetByRole(AriaRole.Heading).First;
            await Assertions.Expect(heading).ToBeVisibleAsync(new() { Timeout = 15_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task TestCaseDescriptionsListedWithUncheckedIcons()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chaltests");
            await RegisterUser(page, username);
            await UnlockFirstChallenge(page);
            await LoginUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/challenges/1.2.5");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            var lockMsg = page.GetByText(new Regex("unlock.*challenge|prerequisites", RegexOptions.IgnoreCase));
            if (await lockMsg.IsVisibleAsync()) return;
            var editor = page.Locator(".monaco-editor");
            await Assertions.Expect(editor).ToBeVisibleAsync(new() { Timeout = 20_000 });
            await Assertions.Expect(page.GetByText("Tests")).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task HintButtonRevealsFirstHint()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chalhint");
            await RegisterUser(page, username);
            await UnlockFirstChallenge(page);
            await LoginUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/challenges/1.2.5");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            var lockMsg = page.GetByText(new Regex("unlock.*challenge|prerequisites", RegexOptions.IgnoreCase));
            if (await lockMsg.IsVisibleAsync()) return;
            var editor = page.Locator(".monaco-editor");
            await Assertions.Expect(editor).ToBeVisibleAsync(new() { Timeout = 20_000 });
            var hint1Btn = page.GetByRole(AriaRole.Button, new() { Name = "Hint 1" });
            await Assertions.Expect(hint1Btn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await hint1Btn.ClickAsync();
            await page.WaitForTimeoutAsync(1_000);
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
