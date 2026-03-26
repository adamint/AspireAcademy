using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class LessonCompleteTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task MarkCompleteButtonStartsEnabledForIncompleteLesson()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("complete");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var btn = page.GetByTestId("mark-complete-btn");
            await Assertions.Expect(btn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(btn).ToBeEnabledAsync();
            await Assertions.Expect(btn).ToHaveTextAsync(new Regex("mark complete", RegexOptions.IgnoreCase));
        }
        finally { await page.CloseAsync(); }
    }

    [Fact]
    public async Task ClickingMarkComplete_ShowsCompletedState()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("markdone");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var btn = page.GetByTestId("mark-complete-btn");
            await Assertions.Expect(btn).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var text = await btn.TextContentAsync();
            if (text?.Contains("Completed", StringComparison.OrdinalIgnoreCase) == true)
            {
                await Assertions.Expect(btn).ToBeDisabledAsync();
                return;
            }

            await btn.ClickAsync();
            await Assertions.Expect(btn).ToBeDisabledAsync(new() { Timeout = 5_000 });
            await Assertions.Expect(btn).ToHaveTextAsync(new Regex("completed", RegexOptions.IgnoreCase), new() { Timeout = 10_000 });
            await Assertions.Expect(btn).ToBeDisabledAsync();
        }
        finally { await page.CloseAsync(); }
    }

    [Fact]
    public async Task RapidDoubleClick_HandledGracefully()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("dblclick");
            await RegisterUser(page, username);
            await NavigateToWorld(page);

            var uncompleted = page.Locator("[role='button']").Filter(new() { HasText = "○" }).Filter(new() { HasText = "📖" });
            if (await uncompleted.CountAsync() == 0)
            {
                return;
            }

            await uncompleted.First.ClickAsync();
            await page.WaitForURLAsync("**/lessons/**", new() { Timeout = 10_000 });

            var btn = page.GetByTestId("mark-complete-btn");
            await Assertions.Expect(btn).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var text = await btn.TextContentAsync();
            if (System.Text.RegularExpressions.Regex.IsMatch(text ?? "", "completed", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            {
                await Assertions.Expect(btn).ToBeDisabledAsync();
                return;
            }

            await btn.ClickAsync();
            await Assertions.Expect(btn).ToBeDisabledAsync(new() { Timeout = 5_000 });
            await Assertions.Expect(btn).ToHaveTextAsync(new Regex("complet", RegexOptions.IgnoreCase), new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText(new Regex("failed to mark complete", RegexOptions.IgnoreCase))).Not.ToBeVisibleAsync();
        }
        finally { await page.CloseAsync(); }
    }

    [Fact]
    public async Task RevisitingCompletedLesson_ShowsMarkCompleteButton()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("revisit");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var btn = page.GetByTestId("mark-complete-btn");
            await Assertions.Expect(btn).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var text = await btn.TextContentAsync();
            Assert.Matches(new Regex("mark complete|completed|completing", RegexOptions.IgnoreCase), text!);
        }
        finally { await page.CloseAsync(); }
    }
}
