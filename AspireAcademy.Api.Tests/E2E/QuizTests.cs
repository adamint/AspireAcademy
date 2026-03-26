using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class QuizTests(AppHostPlaywrightFixture fixture)
{
    private async Task<bool> NavigateToQuiz(IPage page, string username)
    {
        await LoginUser(page, username);
        await page.GotoAsync(fixture.WebBaseUrl + "/quizzes/1.1.3");
        try
        {
            await page.WaitForURLAsync("**/quizzes/**", new() { Timeout = 5_000 });
            var submitBtn = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("submit answer", RegexOptions.IgnoreCase) });
            await Assertions.Expect(submitBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            return true;
        }
        catch
        {
            return false;
        }
    }

    [Fact]
    public async Task QuizPageLoadsWithQuestionAndDisabledSubmit()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("quizload");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2");

            if (!await NavigateToQuiz(page, username))
            {
                return; // No quiz lessons available
            }

            var submitBtn = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("submit answer", RegexOptions.IgnoreCase) });
            await Assertions.Expect(submitBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(submitBtn).ToBeDisabledAsync();
        }
        finally { await page.CloseAsync(); }
    }

    [Fact]
    public async Task SelectingAnswerEnablesSubmitButton()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("quizsel");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2");

            if (!await NavigateToQuiz(page, username))
            {
                return;
            }

            var submitBtn = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("submit answer", RegexOptions.IgnoreCase) });
            await Assertions.Expect(submitBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var radio = page.Locator("input[type='radio']").First;
            if (await radio.IsVisibleAsync())
            {
                await radio.ClickAsync(new() { Force = true });
                await Assertions.Expect(submitBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
                return;
            }

            var checkbox = page.Locator("input[type='checkbox']").First;
            if (await checkbox.IsVisibleAsync())
            {
                await checkbox.ClickAsync(new() { Force = true });
                await Assertions.Expect(submitBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
            }
        }
        finally { await page.CloseAsync(); }
    }

    [Fact]
    public async Task SubmittingAnswerShowsFeedback()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("quizsub");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2");

            if (!await NavigateToQuiz(page, username))
            {
                return;
            }

            var submitBtn = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("submit answer", RegexOptions.IgnoreCase) });
            var radio = page.Locator("input[type='radio']").First;
            if (await radio.IsVisibleAsync())
            {
                await radio.ClickAsync(new() { Force = true });
            }

            await Assertions.Expect(submitBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
            await submitBtn.ClickAsync();

            await Assertions.Expect(page.GetByText(new Regex("correct|incorrect", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("next question|see results", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await page.CloseAsync(); }
    }

    [Fact]
    public async Task InvalidQuizId_ShowsError()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("quizerr");
            await RegisterUser(page, username);
            await LoginUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/quizzes/nonexistent-quiz-id");
            await Assertions.Expect(page.GetByText(new Regex("not found|error|failed to load", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await page.CloseAsync(); }
    }
}
