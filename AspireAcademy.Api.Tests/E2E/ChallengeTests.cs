using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class ChallengeTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task NavigateToChallenge_MonacoEditorLoads()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chalmonaco");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.2.1", "1.2.2", "1.2.3", "1.2.4");
            await LoginUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/challenges/1.2.5");
            await Assertions.Expect(page.Locator(".monaco-editor")).ToBeVisibleAsync(new() { Timeout = 15_000 });
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
            await CompleteLearnLessonsViaApi(page, "1.2.1", "1.2.2", "1.2.3", "1.2.4");
            await LoginUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/challenges/1.2.5");
            await Assertions.Expect(page.Locator(".monaco-editor")).ToBeVisibleAsync(new() { Timeout = 15_000 });
            await Assertions.Expect(page.Locator(".monaco-editor")).ToContainTextAsync("CreateBuilder", new() { Timeout = 10_000 });
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
            await CompleteLearnLessonsViaApi(page, "1.2.1", "1.2.2", "1.2.3", "1.2.4");
            await LoginUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/challenges/1.2.5");
            await Assertions.Expect(page.Locator(".monaco-editor")).ToBeVisibleAsync(new() { Timeout = 15_000 });
            await Assertions.Expect(page.GetByRole(AriaRole.Heading, new() { Name = "First App Challenge", Exact = true })).ToBeVisibleAsync(new() { Timeout = 10_000 });
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
            await CompleteLearnLessonsViaApi(page, "1.2.1", "1.2.2", "1.2.3", "1.2.4");
            await LoginUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/challenges/1.2.5");
            await Assertions.Expect(page.Locator(".monaco-editor")).ToBeVisibleAsync(new() { Timeout = 15_000 });

            await Assertions.Expect(page.GetByText("Tests")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText("Code must compile without errors")).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByText("Must add a Redis resource")).ToBeVisibleAsync();

            var pendingIcons = page.Locator("text=☐");
            Assert.True(await pendingIcons.CountAsync() >= 2);
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
            await CompleteLearnLessonsViaApi(page, "1.2.1", "1.2.2", "1.2.3", "1.2.4");
            await LoginUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/challenges/1.2.5");
            await Assertions.Expect(page.Locator(".monaco-editor")).ToBeVisibleAsync(new() { Timeout = 15_000 });

            var hint1Btn = page.GetByRole(AriaRole.Button, new() { Name = "Hint 1" });
            await Assertions.Expect(hint1Btn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await hint1Btn.ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex(@"AddRedis.*cache", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
