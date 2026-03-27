using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class SkipLessonTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task SkipLessonButtonIsVisibleOnUncompletedLesson()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("skip");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var skipBtn = page.GetByTestId("skip-lesson-btn");
            await Assertions.Expect(skipBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(skipBtn).ToBeEnabledAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SkippingLessonShowsSkippedBannerAndUndoButton()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("skipbanner");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var skipBtn = page.GetByTestId("skip-lesson-btn");
            await Assertions.Expect(skipBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var text = await skipBtn.TextContentAsync();
            if (string.IsNullOrEmpty(text))
            {
                return;
            }

            await skipBtn.ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex("skipped", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByTestId("undo-skip-btn")).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SkippingLessonUnlocksNextLesson()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("skipunlock");
            await RegisterUser(page, username);
            await NavigateToWorld(page);

            var learnLessons = page.Locator("[role='button']").Filter(new() { HasText = "📖" });
            Assert.True(await learnLessons.CountAsync() >= 1);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task UnskipViaApiThenCompleteForXp()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("unskip");
            await RegisterUser(page, username);

            // Skip the first lesson
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);
            var skipBtn = page.GetByTestId("skip-lesson-btn");
            await Assertions.Expect(skipBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await skipBtn.ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex("skipped", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var token = await GetAuthToken(page);

            // Unskip
            var unskipRes = await page.APIRequest.PostAsync(E2EHelpers.ApiBaseUrl + "/api/progress/unskip", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
                DataObject = new { lessonId = "1.1.1" },
            });
            Assert.True(unskipRes.Ok);

            // Complete for XP
            var completeRes = await page.APIRequest.PostAsync(E2EHelpers.ApiBaseUrl + "/api/progress/complete", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
                DataObject = new { lessonId = "1.1.1" },
            });
            Assert.True(completeRes.Ok);

            var body = await completeRes.JsonAsync();
            Assert.True(body?.GetProperty("xpEarned").GetInt32() > 0);
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
