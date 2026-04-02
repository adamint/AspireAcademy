using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class LessonNavigationTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task LessonPageShowsPreviousAndNextButtons()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("prevnext");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1");
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var markComplete = page.GetByTestId("mark-complete-btn");
            await Assertions.Expect(markComplete).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var mainButtons = page.GetByRole(AriaRole.Main).GetByRole(AriaRole.Button);
            Assert.True(await mainButtons.CountAsync() >= 3);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task NextButtonNavigatesToDifferentPage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("next");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1");
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await DismissPopups(page);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var markComplete = page.GetByTestId("mark-complete-btn");
            await Assertions.Expect(markComplete).ToBeVisibleAsync(new() { Timeout = 20_000 });

            var mainButtons = page.GetByRole(AriaRole.Main).GetByRole(AriaRole.Button);
            var count = await mainButtons.CountAsync();
            var nextBtn = mainButtons.Nth(count - 1);

            if (await nextBtn.IsDisabledAsync())
            {
                return;
            }

            var firstUrl = page.Url;
            await nextBtn.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex(@"/(lessons|quizzes|challenges)/"), new() { Timeout = 20_000 });
            Assert.NotEqual(firstUrl, page.Url);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task PreviousButtonNavigatesBack()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("prev");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1");
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await DismissPopups(page);
            await NavigateToWorld(page);

            // Go directly to the second lesson instead of relying on Next button from first
            await page.GotoAsync(fixture.WebBaseUrl + "/lessons/1.1.2");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await DismissPopups(page);

            var markComplete = page.GetByTestId("mark-complete-btn");
            await Assertions.Expect(markComplete).ToBeVisibleAsync(new() { Timeout = 20_000 });

            var mainButtons = page.GetByRole(AriaRole.Main).GetByRole(AriaRole.Button);
            var count = await mainButtons.CountAsync();
            // Previous button is the second-to-last
            var prevBtn = mainButtons.Nth(count - 2);

            if (await prevBtn.IsDisabledAsync())
            {
                return;
            }

            var currentUrl = page.Url;
            await prevBtn.ClickAsync();
            await Assertions.Expect(page).Not.ToHaveURLAsync(currentUrl, new() { Timeout = 20_000 });
            await Assertions.Expect(page).ToHaveURLAsync(new Regex(@"/(lessons|quizzes|challenges)/"), new() { Timeout = 20_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task BackButtonNavigatesAwayFromLessonPage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("back");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var backBtn = page.Locator("button").Filter(new() { HasTextRegex = new Regex("back to", RegexOptions.IgnoreCase) });
            await Assertions.Expect(backBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await backBtn.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex(@"/(worlds|dashboard)"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task BackButtonTextContainsBackTo()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("backtext");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var backBtn = page.Locator("button").Filter(new() { HasTextRegex = new Regex("back to", RegexOptions.IgnoreCase) });
            await Assertions.Expect(backBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            var text = await backBtn.TextContentAsync();
            Assert.Matches(new Regex("back to", RegexOptions.IgnoreCase), text!);
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
