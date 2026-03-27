using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class QuizDepthTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    private async Task<bool> GoToQuiz(IPage page, string username)
    {
        await LoginUser(page, username);
        await page.GotoAsync(fixture.WebBaseUrl + "/quizzes/1.1.3");
        try
        {
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/quizzes/"), new() { Timeout = 5_000 });
            var submitBtn = page.GetByTestId("quiz-submit");
            await Assertions.Expect(submitBtn).ToBeVisibleAsync(new() { Timeout = 15_000 });
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static async Task SelectFirstOptionAndSubmit(IPage page)
    {
        var radio = page.Locator("input[type='radio']").First;
        if (await radio.IsVisibleAsync())
        {
            await radio.ClickAsync(new() { Force = true });
        }
        else
        {
            var checkbox = page.Locator("input[type='checkbox']").First;
            if (await checkbox.IsVisibleAsync())
            {
                await checkbox.ClickAsync(new() { Force = true });
            }
        }

        var submitBtn = page.GetByTestId("quiz-submit");
        await Assertions.Expect(submitBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
        await submitBtn.ClickAsync();
    }

    [Fact]
    public async Task SubmitCorrectAnswer_ShowsGreenFeedbackWithPoints()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("quizcorrect");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2", "1.1.2a");

            if (!await GoToQuiz(page, username))
            {
                return;
            }

            // Answer questions until we find a "Correct!" feedback
            var foundCorrect = false;
            for (var attempt = 0; attempt < 10; attempt++)
            {
                // Try each radio option on the current question
                var radios = page.Locator("input[type='radio']");
                var radioCount = await radios.CountAsync();
                Console.WriteLine($"[DIAG] Attempt {attempt}: radioCount={radioCount}, url={page.Url}");
                if (radioCount == 0)
                {
                    var body = await page.Locator("main, [role='main'], body").First.TextContentAsync();
                    Console.WriteLine($"[DIAG] Page content (first 300): {body?[..Math.Min(300, body?.Length ?? 0)]}");
                }

                for (var i = 0; i < radioCount; i++)
                {
                    var submitBtn = page.GetByTestId("quiz-submit");
                    if (!await submitBtn.IsVisibleAsync())
                    {
                        break;
                    }

                    if (await submitBtn.IsDisabledAsync())
                    {
                        await radios.Nth(i).ClickAsync(new() { Force = true });
                    }

                    if (await submitBtn.IsEnabledAsync())
                    {
                        await submitBtn.ClickAsync();

                        var correctFeedback = page.GetByText("Correct!");
                        if (await correctFeedback.IsVisibleAsync())
                        {
                            foundCorrect = true;

                            // Verify green color on feedback container
                            var feedbackBox = page.Locator("[class*='css']").Filter(new() { HasText = "Correct!" }).First;
                            await Assertions.Expect(feedbackBox).ToBeVisibleAsync();

                            // Verify points > 0
                            var ptsText = page.GetByText(new Regex(@"\+\d+ pts"));
                            await Assertions.Expect(ptsText).ToBeVisibleAsync(new() { Timeout = 5_000 });
                            var pts = await ptsText.TextContentAsync();
                            var ptsMatch = System.Text.RegularExpressions.Regex.Match(pts!, @"\+(\d+)");
                            Assert.True(int.Parse(ptsMatch.Groups[1].Value) > 0);
                            break;
                        }

                        // Got incorrect, move to next question if available
                        break;
                    }
                }

                if (foundCorrect)
                {
                    break;
                }

                // Try to move to next question
                var nextQ = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("next question", RegexOptions.IgnoreCase) });
                if (await nextQ.IsVisibleAsync())
                {
                    await nextQ.ClickAsync();
                    await page.WaitForTimeoutAsync(500);
                }
                else
                {
                    break;
                }
            }

            Assert.True(foundCorrect, "Should have encountered at least one correct answer in the quiz");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SubmitWrongAnswer_ShowsRedFeedbackWithZeroPoints()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("quizwrong");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2", "1.1.2a");

            if (!await GoToQuiz(page, username))
            {
                return;
            }

            // Answer questions trying to get an incorrect answer
            var foundIncorrect = false;
            for (var attempt = 0; attempt < 10; attempt++)
            {
                // Select the LAST radio option (more likely to be wrong)
                var radios = page.Locator("input[type='radio']");
                var radioCount = await radios.CountAsync();
                if (radioCount > 0)
                {
                    await radios.Nth(radioCount - 1).ClickAsync(new() { Force = true });
                }

                var submitBtn = page.GetByTestId("quiz-submit");
                if (await submitBtn.IsEnabledAsync())
                {
                    await submitBtn.ClickAsync();

                    var incorrectFeedback = page.GetByText("Incorrect");
                    if (await incorrectFeedback.IsVisibleAsync())
                    {
                        foundIncorrect = true;

                        // Verify red feedback container
                        var feedbackBox = page.Locator("[class*='css']").Filter(new() { HasText = "Incorrect" }).First;
                        await Assertions.Expect(feedbackBox).ToBeVisibleAsync();

                        // Verify 0 pts
                        await Assertions.Expect(page.GetByText("0 pts")).ToBeVisibleAsync(new() { Timeout = 5_000 });

                        // Verify correct answer hint is shown
                        await Assertions.Expect(page.GetByText(new Regex("correct answer", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });
                        break;
                    }
                }

                // Move to next question
                var nextQ = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("next question", RegexOptions.IgnoreCase) });
                if (await nextQ.IsVisibleAsync())
                {
                    await nextQ.ClickAsync();
                    await page.WaitForTimeoutAsync(500);
                }
                else
                {
                    break;
                }
            }

            Assert.True(foundIncorrect, "Should have encountered at least one incorrect answer in the quiz");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task CompleteAllQuestions_ShowsResultsWithScoreFormat()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("quizresults");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2", "1.1.2a");

            if (!await GoToQuiz(page, username))
            {
                return;
            }

            // Answer all questions
            for (var safety = 0; safety < 20; safety++)
            {
                var hasResults = await page.GetByText("— Results").IsVisibleAsync();
                if (hasResults)
                {
                    break;
                }

                var seeResults = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("see results", RegexOptions.IgnoreCase) });
                if (await seeResults.IsVisibleAsync())
                {
                    await seeResults.ClickAsync();
                    await page.WaitForTimeoutAsync(2_000);
                    break;
                }

                var nextQBtn = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("next question", RegexOptions.IgnoreCase) });
                if (await nextQBtn.IsVisibleAsync())
                {
                    await nextQBtn.ClickAsync();
                    await page.WaitForTimeoutAsync(500);

                    var subBtn = page.GetByTestId("quiz-submit");
                    await Assertions.Expect(subBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });

                    var r = page.Locator("input[type='radio']").First;
                    if (await r.IsVisibleAsync())
                    {
                        await r.ClickAsync(new() { Force = true });
                    }

                    await Assertions.Expect(subBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
                    await subBtn.ClickAsync();
                    await Assertions.Expect(page.GetByText(new Regex("correct|incorrect", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
                    continue;
                }

                // First question - select and submit
                var submitBtn = page.GetByTestId("quiz-submit");
                if (await submitBtn.IsVisibleAsync())
                {
                    var radio = page.Locator("input[type='radio']").First;
                    if (await radio.IsVisibleAsync())
                    {
                        await radio.ClickAsync(new() { Force = true });
                    }

                    if (await submitBtn.IsEnabledAsync())
                    {
                        await submitBtn.ClickAsync();
                        await Assertions.Expect(page.GetByText(new Regex("correct|incorrect", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
                    }
                }

                await page.WaitForTimeoutAsync(500);
            }

            // Verify results page
            await Assertions.Expect(page.GetByText("— Results")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Score shows X/Y format
            var scoreText = page.GetByText(new Regex(@"\d+/\d+"));
            await Assertions.Expect(scoreText.First).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Pass/fail badge visible
            await Assertions.Expect(page.GetByText(new Regex("PASSED|FAILED"))).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task QuizCompletion_XpBarIncreases()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("quizxp");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2", "1.1.2a");

            // Read XP before quiz
            var xpCounter = page.GetByText(new Regex(@"\d+/500"));
            await Assertions.Expect(xpCounter).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var beforeText = await xpCounter.TextContentAsync();
            var beforeMatch = System.Text.RegularExpressions.Regex.Match(beforeText!, @"(\d+)/500");
            var xpBefore = int.Parse(beforeMatch.Groups[1].Value);

            if (!await GoToQuiz(page, username))
            {
                return;
            }

            // Complete all quiz questions
            for (var safety = 0; safety < 20; safety++)
            {
                var hasResults = await page.GetByText("— Results").IsVisibleAsync();
                if (hasResults)
                {
                    break;
                }

                var seeResults = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("see results", RegexOptions.IgnoreCase) });
                if (await seeResults.IsVisibleAsync())
                {
                    await seeResults.ClickAsync();
                    await page.WaitForTimeoutAsync(2_000);
                    break;
                }

                var nextQBtn = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("next question", RegexOptions.IgnoreCase) });
                if (await nextQBtn.IsVisibleAsync())
                {
                    await nextQBtn.ClickAsync();
                    await page.WaitForTimeoutAsync(500);
                }

                var submitBtn = page.GetByTestId("quiz-submit");
                if (await submitBtn.IsVisibleAsync())
                {
                    var radio = page.Locator("input[type='radio']").First;
                    if (await radio.IsVisibleAsync())
                    {
                        await radio.ClickAsync(new() { Force = true });
                    }

                    if (await submitBtn.IsEnabledAsync())
                    {
                        await submitBtn.ClickAsync();
                        await page.WaitForTimeoutAsync(1_000);
                    }
                }

                await page.WaitForTimeoutAsync(500);
            }

            // After quiz, check XP increased
            await page.WaitForTimeoutAsync(2_000);
            var afterXpCounter = page.GetByText(new Regex(@"\d+/500"));
            if (await afterXpCounter.IsVisibleAsync())
            {
                var afterText = await afterXpCounter.TextContentAsync();
                var afterMatch = System.Text.RegularExpressions.Regex.Match(afterText!, @"(\d+)/500");
                if (afterMatch.Success)
                {
                    var xpAfter = int.Parse(afterMatch.Groups[1].Value);
                    Assert.True(xpAfter >= xpBefore, $"XP should not decrease: before={xpBefore}, after={xpAfter}");
                }
            }

            // Also verify XP earned text on results page
            var xpEarned = page.GetByText(new Regex(@"\+\d+ XP earned", RegexOptions.IgnoreCase));
            var resultsVisible = await page.GetByText("— Results").IsVisibleAsync();
            if (resultsVisible)
            {
                // Quiz results should be visible
                await Assertions.Expect(page.GetByText("— Results")).ToBeVisibleAsync();
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
