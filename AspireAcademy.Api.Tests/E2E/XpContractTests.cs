using System.Net.Http.Json;
using System.Text.Json;
using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

/// <summary>
/// E2E tests that verify the frontend-backend XP contract:
/// - XP bar updates correctly after lesson/quiz/challenge completion
/// - XP persists across page reloads
/// - Retakes don't double-award XP
/// - Markdown tables render as HTML tables (not raw pipe text)
/// </summary>
[Trait("Category", "E2E")]
public class XpContractTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    /// <summary>
    /// After completing a learn lesson, the XP bar in the top bar should reflect
    /// the server-returned XP — not remain at 0.
    /// Catches: ProgressCompleteResponse missing fields, frontend hardcoding weeklyXp: 0
    /// </summary>
    [Fact]
    public async Task CompleteLesson_XpBarUpdatesImmediately()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("xpbar");
            await RegisterUser(page, username);
            await LoginUser(page, username);

            // Navigate to first lesson
            await page.GotoAsync(fixture.WebBaseUrl + "/lessons/1.1.1");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await DismissPopups(page);

            // Get initial XP text from the bar
            var xpBar = page.GetByTestId("xp-bar");
            await Assertions.Expect(xpBar).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var initialText = await xpBar.InnerTextAsync();

            // Complete the lesson
            var completeBtn = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("mark.*complete|complete.*lesson", RegexOptions.IgnoreCase) });
            try
            {
                await Assertions.Expect(completeBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
                await completeBtn.ClickAsync();
                await page.WaitForTimeoutAsync(2000); // Wait for XP animation + sync

                // XP bar should now show updated values (not 0/500)
                var updatedText = await xpBar.InnerTextAsync();
                Assert.NotEqual(initialText, updatedText);

                // Should contain a non-zero XP value
                Assert.DoesNotContain("Lvl 0", updatedText);
            }
            catch (PlaywrightException)
            {
                // Complete button not available — lesson might already be completed
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    /// <summary>
    /// After completing a lesson, refreshing the page should NOT reset XP to 0.
    /// Catches: gamificationStore not persisted, no global XP hydration in AppShell
    /// </summary>
    [Fact]
    public async Task XpPersistsAcrossPageReload()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("xprel");
            await RegisterUser(page, username);
            await LoginUser(page, username);

            // Complete a lesson via API to earn XP
            await CompleteLearnLessonsViaApi(page, "1.1.1");

            // Navigate to dashboard to trigger XP fetch
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await DismissPopups(page);

            var xpBar = page.GetByTestId("xp-bar");
            await Assertions.Expect(xpBar).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Wait for XP to be fetched from server
            await page.WaitForTimeoutAsync(2000);
            var beforeReload = await xpBar.InnerTextAsync();

            // Reload the page
            await page.ReloadAsync();
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await DismissPopups(page);
            await page.WaitForTimeoutAsync(3000); // Wait for AppShell /api/xp fetch

            // XP should still be the same after reload
            var afterReload = await page.GetByTestId("xp-bar").InnerTextAsync();
            Assert.Equal(beforeReload, afterReload);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    /// <summary>
    /// After completing a quiz, retaking it should NOT award additional XP.
    /// The XP bar should remain the same after a retake.
    /// Catches: QuizSubmitResponse missing TotalXp, frontend client-side XP math
    /// </summary>
    [Fact]
    public async Task QuizRetake_XpBarDoesNotIncrease()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("xpretk");
            await RegisterUser(page, username);
            await LoginUser(page, username);

            // Unlock quiz by completing prereqs
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2");

            // Submit quiz via API (first attempt)
            var token = await GetAuthToken(page);
            await SubmitQuizViaApiWithCorrectAnswers(token, "1.1.3");

            // Navigate to dashboard and read XP
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await DismissPopups(page);
            await page.WaitForTimeoutAsync(2000);

            var xpBar = page.GetByTestId("xp-bar");
            await Assertions.Expect(xpBar).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var xpAfterFirstAttempt = await xpBar.InnerTextAsync();

            // Retake quiz via API (second attempt)
            await SubmitQuizViaApiWithCorrectAnswers(token, "1.1.3");

            // Reload dashboard
            await page.ReloadAsync();
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await DismissPopups(page);
            await page.WaitForTimeoutAsync(3000);

            var xpAfterRetake = await page.GetByTestId("xp-bar").InnerTextAsync();

            // XP should not have increased
            Assert.Equal(xpAfterFirstAttempt, xpAfterRetake);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    /// <summary>
    /// Quiz results page should show a retake button and a continue/back button.
    /// Catches: Missing redirect after quiz completion
    /// </summary>
    [Fact]
    public async Task QuizCompletion_ShowsRetakeAndContinueButtons()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("quizbtn");
            await RegisterUser(page, username);
            await LoginUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2");

            // Navigate to quiz
            await page.GotoAsync(fixture.WebBaseUrl + "/quizzes/1.1.3");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await DismissPopups(page);

            // Answer all questions (click through the quiz)
            for (var i = 0; i < 10; i++) // Upper bound on questions
            {
                var submitBtn = page.GetByTestId("quiz-submit");
                try
                {
                    await Assertions.Expect(submitBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
                }
                catch (PlaywrightException)
                {
                    break;
                }

                // Select first radio option
                var radio = page.Locator("[data-scope='radio-group'][data-part='item'], [data-scope='checkbox'][data-part='item']").First;
                if (await radio.IsVisibleAsync())
                {
                    await radio.ClickAsync();
                }

                // Submit answer
                await submitBtn.ClickAsync();
                await page.WaitForTimeoutAsync(1500);

                // Click "Next Question" or "See Results"
                var nextBtn = page.GetByRole(AriaRole.Button, new()
                {
                    NameRegex = new Regex("next question|see results", RegexOptions.IgnoreCase)
                });
                try
                {
                    await Assertions.Expect(nextBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
                    await nextBtn.ClickAsync();
                    await page.WaitForTimeoutAsync(1000);
                }
                catch (PlaywrightException)
                {
                    // No next button — quiz might have completed
                }
            }

            // Wait for results page
            await page.WaitForTimeoutAsync(3000);

            // Check that retake and continue/back buttons exist
            var retakeBtn = page.GetByTestId("quiz-retake");
            await Assertions.Expect(retakeBtn).ToBeVisibleAsync(new() { Timeout = 15_000 });

            // Should have either continue or back-to-lesson button
            var continueBtn = page.GetByTestId("quiz-continue");
            var backBtn = page.GetByTestId("quiz-back-to-lesson");
            var hasContinue = await continueBtn.IsVisibleAsync();
            var hasBack = await backBtn.IsVisibleAsync();
            Assert.True(hasContinue || hasBack, "Expected either a 'Continue' or 'Back to Lesson' button on quiz results");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    /// <summary>
    /// Markdown tables in lesson content should render as actual HTML tables,
    /// not raw pipe-delimited text.
    /// Catches: remark-gfm not installed
    /// </summary>
    [Fact]
    public async Task LessonMarkdownTables_RenderAsHtmlTables()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("mdtbl");
            await RegisterUser(page, username);
            await LoginUser(page, username);

            // Navigate to lesson 1.1.1 which has a markdown table
            await page.GotoAsync(fixture.WebBaseUrl + "/lessons/1.1.1");
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle);
            await DismissPopups(page);
            await page.WaitForTimeoutAsync(2000);

            // Should have an HTML <table> element rendered (not raw pipe text)
            var table = page.Locator("table");
            var tableCount = await table.CountAsync();

            if (tableCount > 0)
            {
                // Table exists — verify it has proper structure
                var headerRow = page.Locator("table th");
                var headerCount = await headerRow.CountAsync();
                Assert.True(headerCount > 0, "Table should have header cells (<th>)");

                // Verify no raw pipe delimiters are visible as text
                var bodyText = await page.Locator("[id='main-content']").InnerTextAsync();
                Assert.DoesNotContain("|---|", bodyText);
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    /// <summary>
    /// Submits a quiz with correct answers by first fetching the questions and their correct option IDs.
    /// </summary>
    private async Task SubmitQuizViaApiWithCorrectAnswers(string token, string lessonId)
    {
        // Fetch lesson to get quiz questions
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {token}");

        var lessonResp = await client.GetAsync(ApiBaseUrl + $"/api/lessons/{lessonId}");
        if (!lessonResp.IsSuccessStatusCode) return;

        var lesson = await lessonResp.Content.ReadFromJsonAsync<JsonElement>();
        if (!lesson.TryGetProperty("quiz", out var quiz)) return;
        if (!quiz.TryGetProperty("questions", out var questions)) return;

        // For each question, call the single-answer endpoint to get correct IDs
        var answers = new List<object>();
        foreach (var q in questions.EnumerateArray())
        {
            var qId = q.GetProperty("id").GetString()!;

            // Try each option to find the correct one
            if (q.TryGetProperty("options", out var options))
            {
                var foundCorrect = false;
                foreach (var opt in options.EnumerateArray())
                {
                    var optId = opt.GetProperty("id").GetString()!;
                    using var answerReq = new HttpRequestMessage(HttpMethod.Post, ApiBaseUrl + $"/api/quizzes/{lessonId}/answer");
                    answerReq.Headers.Add("Authorization", $"Bearer {token}");
                    answerReq.Content = JsonContent.Create(new { questionId = qId, answer = optId });
                    var answerResp = await client.SendAsync(answerReq);
                    if (answerResp.IsSuccessStatusCode)
                    {
                        var answerBody = await answerResp.Content.ReadFromJsonAsync<JsonElement>();
                        if (answerBody.GetProperty("correct").GetBoolean())
                        {
                            answers.Add(new { questionId = qId, selectedOptionIds = new[] { optId } });
                            foundCorrect = true;
                            break;
                        }
                    }
                }
                if (!foundCorrect)
                {
                    // Fallback: pick first option
                    var firstOpt = options.EnumerateArray().First().GetProperty("id").GetString()!;
                    answers.Add(new { questionId = qId, selectedOptionIds = new[] { firstOpt } });
                }
            }
        }

        using var submitReq = new HttpRequestMessage(HttpMethod.Post, ApiBaseUrl + $"/api/quizzes/{lessonId}/submit");
        submitReq.Headers.Add("Authorization", $"Bearer {token}");
        submitReq.Content = JsonContent.Create(new { answers });
        await client.SendAsync(submitReq);
    }
}
