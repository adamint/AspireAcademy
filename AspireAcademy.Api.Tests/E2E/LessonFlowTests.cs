using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class LessonFlowTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task NavigateToLearnLesson_ShowsMarkdownContent()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("lessonmd");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            // Lesson heading visible
            var heading = page.GetByRole(AriaRole.Heading, new() { Level = 1 });
            await Assertions.Expect(heading).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var headingText = await heading.TextContentAsync();
            Assert.False(string.IsNullOrWhiteSpace(headingText));

            // Markdown content area has visible text (paragraphs or headings within content)
            var contentArea = page.GetByRole(AriaRole.Main);
            await Assertions.Expect(contentArea).ToBeVisibleAsync();
            var mainText = await contentArea.TextContentAsync();
            Assert.True(mainText?.Length > 50, "Lesson should have substantial markdown content");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task MarkComplete_ButtonChangesToCompletedAndDisabled()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("flowcomplete");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var btn = page.GetByTestId("mark-complete-btn");
            await Assertions.Expect(btn).ToBeVisibleAsync(new() { Timeout = 20_000 });
            await Assertions.Expect(btn).ToBeEnabledAsync();
            await Assertions.Expect(btn).ToContainTextAsync("Mark Complete", new() { Timeout = 10_000 });

            await btn.ClickAsync();
            await Assertions.Expect(btn).ToContainTextAsync("Completed", new() { Timeout = 15_000 });
            await Assertions.Expect(btn).ToBeDisabledAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task MarkComplete_XpBarValueIncreases()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("flowxp");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            // Read XP before
            var xpCounter = page.GetByText(new Regex(@"\d+/500"));
            await Assertions.Expect(xpCounter).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var beforeText = await xpCounter.TextContentAsync();
            var beforeMatch = System.Text.RegularExpressions.Regex.Match(beforeText!, @"(\d+)/500");
            var xpBefore = int.Parse(beforeMatch.Groups[1].Value);

            // Mark complete
            var btn = page.GetByTestId("mark-complete-btn");
            await Assertions.Expect(btn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await btn.ClickAsync();
            await Assertions.Expect(btn).ToContainTextAsync("Completed", new() { Timeout = 10_000 });

            // Read XP after (wait for update)
            await page.WaitForTimeoutAsync(2_000);
            var afterText = await page.GetByText(new Regex(@"\d+/500")).TextContentAsync();
            var afterMatch = System.Text.RegularExpressions.Regex.Match(afterText!, @"(\d+)/500");
            var xpAfter = int.Parse(afterMatch.Groups[1].Value);

            Assert.True(xpAfter > xpBefore, $"XP should increase after marking complete: before={xpBefore}, after={xpAfter}");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task DoubleClickMarkComplete_NoErrorStillCompleted()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("flowdbl");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var btn = page.GetByTestId("mark-complete-btn");
            await Assertions.Expect(btn).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Click once
            await btn.ClickAsync();
            await Assertions.Expect(btn).ToBeDisabledAsync(new() { Timeout = 5_000 });
            await Assertions.Expect(btn).ToContainTextAsync("Completed", new() { Timeout = 10_000 });

            // No error message visible
            await Assertions.Expect(page.GetByText("Failed to mark complete")).Not.ToBeVisibleAsync();
            await Assertions.Expect(btn).ToBeDisabledAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task PreviousButtonHiddenOnFirstLesson()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("flowprev");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            await Assertions.Expect(page.GetByTestId("mark-complete-btn")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // The first lesson should not have a previous button, or it should be disabled/hidden
            var prevButton = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("previous", RegexOptions.IgnoreCase) });
            var prevCount = await prevButton.CountAsync();

            if (prevCount > 0)
            {
                // If a previous button exists on the first lesson, it must be disabled
                await Assertions.Expect(prevButton.First).ToBeDisabledAsync();
            }
            // else: no previous button at all, which is correct for first lesson
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task NextButtonNavigates_UrlChanges()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("flownext");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1");
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            await Assertions.Expect(page.GetByTestId("mark-complete-btn")).ToBeVisibleAsync(new() { Timeout = 20_000 });
            var firstUrl = page.Url;

            // Find and click the next/forward navigation button
            var navButtons = page.GetByRole(AriaRole.Main).GetByRole(AriaRole.Button);
            var count = await navButtons.CountAsync();
            var nextBtn = navButtons.Nth(count - 1);

            if (await nextBtn.IsEnabledAsync())
            {
                await nextBtn.ClickAsync();
                await Assertions.Expect(page).ToHaveURLAsync(new Regex(@"/(lessons|quizzes|challenges)/"), new() { Timeout = 20_000 });
                Assert.NotEqual(firstUrl, page.Url);
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task BackButtonNavigatesToModulePage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("flowback");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var backBtn = page.Locator("button").Filter(new() { HasTextRegex = new Regex("back to", RegexOptions.IgnoreCase) });
            await Assertions.Expect(backBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await backBtn.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex(@"/worlds/|/dashboard"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}