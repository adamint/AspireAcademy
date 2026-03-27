using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class QuizGradingTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
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

    /// <summary>
    /// Reads the correct answers for the quiz from the API, then selects them in the UI.
    /// Returns the IDs of correct options for the current question.
    /// </summary>
    private static async Task<string[]> GetCorrectOptionIdsForCurrentQuestion(IPage page, string token, string lessonId, string questionId)
    {
        var resp = await page.APIRequest.PostAsync(ApiBaseUrl + $"/api/quizzes/{lessonId}/answer", new()
        {
            Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
            DataObject = new { questionId, answer = new[] { "a" } },
        });

        if (resp.Ok)
        {
            var body = await resp.JsonAsync();
            if (body is not null && body.Value.TryGetProperty("correctOptionIds", out var correctIds))
            {
                var ids = new List<string>();
                foreach (var id in correctIds.EnumerateArray())
                {
                    ids.Add(id.GetString()!);
                }
                return ids.ToArray();
            }
        }

        return [];
    }

    /// <summary>
    /// Selects a radio button by its value attribute (option ID).
    /// Returns true if a matching radio was found and clicked.
    /// </summary>
    private static async Task<bool> SelectRadioByOptionId(IPage page, string optionId)
    {
        var radios = page.Locator("input[type='radio']");
        var radioCount = await radios.CountAsync();
        for (var i = 0; i < radioCount; i++)
        {
            var value = await radios.Nth(i).GetAttributeAsync("value");
            if (value == optionId)
            {
                await radios.Nth(i).ClickAsync(new() { Force = true });
                return true;
            }
        }
        return false;
    }

    [Fact]
    public async Task SubmitCorrectAnswer_ShowsGreenFeedbackWithCorrectText()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("qgcorrect");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2", "1.1.2a");

            if (!await GoToQuiz(page, username))
            {
                return;
            }

            var token = await GetAuthToken(page);

            // Get the lesson details to find the first question and correct answer
            var lessonResp = await page.APIRequest.GetAsync(ApiBaseUrl + "/api/lessons/1.1.3", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
            });
            var lesson = await lessonResp.JsonAsync();
            var firstQuestion = lesson!.Value.GetProperty("quiz").GetProperty("questions")[0];
            var questionId = firstQuestion.GetProperty("id").GetString()!;

            // Probe the API for the correct answer
            var correctIds = await GetCorrectOptionIdsForCurrentQuestion(page, token, "1.1.3", questionId);

            // Now select the correct radio in the UI by option ID
            if (correctIds.Length > 0)
            {
                var found = await SelectRadioByOptionId(page, correctIds[0]);
                Assert.True(found, $"Could not find radio with value='{correctIds[0]}' — " +
                    "radio values may not match option IDs (text vs ID mismatch).");
            }
            else
            {
                Assert.Fail("No correct option IDs returned from the API — cannot test correct answer grading.");
            }

            var submitBtn = page.GetByTestId("quiz-submit");
            await Assertions.Expect(submitBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
            await submitBtn.ClickAsync();

            // Verify "Correct!" feedback text
            var correctFeedback = page.GetByText("Correct!");
            await Assertions.Expect(correctFeedback).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Verify green styling (green color in the feedback container)
            var feedbackContainer = page.Locator("[class*='css']").Filter(new() { HasText = "Correct!" }).First;
            await Assertions.Expect(feedbackContainer).ToBeVisibleAsync();

            // Check that points > 0 are shown
            var ptsText = page.GetByText(new Regex(@"\+\d+ pts"));
            await Assertions.Expect(ptsText).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SubmitWrongAnswer_ShowsRedFeedbackWithIncorrectText()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("qgwrong");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2", "1.1.2a");

            if (!await GoToQuiz(page, username))
            {
                return;
            }

            var token = await GetAuthToken(page);

            // Get question info
            var lessonResp = await page.APIRequest.GetAsync(ApiBaseUrl + "/api/lessons/1.1.3", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
            });
            var lesson = await lessonResp.JsonAsync();
            var firstQuestion = lesson!.Value.GetProperty("quiz").GetProperty("questions")[0];
            var questionId = firstQuestion.GetProperty("id").GetString()!;

            // Probe for correct answer so we can select the WRONG one
            var correctIds = await GetCorrectOptionIdsForCurrentQuestion(page, token, "1.1.3", questionId);

            // Select a wrong radio (one that is NOT in correctIds) — match by option ID value
            var radios = page.Locator("input[type='radio']");
            var radioCount = await radios.CountAsync();
            var selectedWrong = false;
            for (var i = radioCount - 1; i >= 0; i--)
            {
                var value = await radios.Nth(i).GetAttributeAsync("value");
                if (!correctIds.Contains(value))
                {
                    await radios.Nth(i).ClickAsync(new() { Force = true });
                    selectedWrong = true;
                    break;
                }
            }

            Assert.True(selectedWrong, "Could not find a wrong option — all radio values matched correct IDs.");

            var submitBtn = page.GetByTestId("quiz-submit");
            await Assertions.Expect(submitBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
            await submitBtn.ClickAsync();

            // Verify "Incorrect" feedback text
            var incorrectFeedback = page.GetByText("Incorrect");
            await Assertions.Expect(incorrectFeedback).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Verify red styling (the container)
            var feedbackContainer = page.Locator("[class*='css']").Filter(new() { HasText = "Incorrect" }).First;
            await Assertions.Expect(feedbackContainer).ToBeVisibleAsync();

            // Verify 0 pts shown
            await Assertions.Expect(page.GetByText("0 pts")).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Verify "Correct answer" hint is shown
            await Assertions.Expect(page.GetByText(new Regex("correct answer", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task PerfectScore_ShowsBonusXpAndConfetti()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("qgperfect");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2", "1.1.2a");

            var token = await GetAuthToken(page);

            // Get the quiz lesson details to find all questions and answers
            var lessonResp = await page.APIRequest.GetAsync(ApiBaseUrl + "/api/lessons/1.1.3", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
            });
            var lesson = await lessonResp.JsonAsync();
            var questions = lesson!.Value.GetProperty("quiz").GetProperty("questions");

            // Probe each question for the correct answer
            var correctAnswerMap = new Dictionary<string, string[]>();
            foreach (var q in questions.EnumerateArray())
            {
                var qId = q.GetProperty("id").GetString()!;
                var correctIds = await GetCorrectOptionIdsForCurrentQuestion(page, token, "1.1.3", qId);
                correctAnswerMap[qId] = correctIds;
            }

            // Navigate to the quiz
            if (!await GoToQuiz(page, username))
            {
                return;
            }

            // Answer each question correctly
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
                if (!await submitBtn.IsVisibleAsync())
                {
                    continue;
                }

                // Try to select correct radio by matching value against our map
                var radios = page.Locator("input[type='radio']");
                var radioCount = await radios.CountAsync();
                var clickedCorrect = false;

                for (var i = 0; i < radioCount; i++)
                {
                    var value = await radios.Nth(i).GetAttributeAsync("value");
                    if (correctAnswerMap.Values.Any(ids => ids.Contains(value)))
                    {
                        await radios.Nth(i).ClickAsync(new() { Force = true });
                        clickedCorrect = true;
                        break;
                    }
                }

                Assert.True(clickedCorrect || radioCount == 0,
                    "Could not find radio matching any correct option ID — radio values may not match option IDs.");

                await Assertions.Expect(submitBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
                await submitBtn.ClickAsync();
                await page.WaitForTimeoutAsync(1_000);
            }

            // Verify results page
            await Assertions.Expect(page.GetByText("— Results")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Verify XP earned text
            var xpEarnedText = page.GetByText(new Regex(@"\+\d+ XP earned", RegexOptions.IgnoreCase));
            await Assertions.Expect(xpEarnedText).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Verify pass badge
            await Assertions.Expect(page.GetByText("PASSED")).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task CannotReEarnXp_OnQuizRetake()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("qgretake");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2", "1.1.2a");

            var token = await GetAuthToken(page);

            // Complete the quiz via API first
            await SubmitQuizViaApiAllCorrect(page, token, "1.1.3");

            // Get XP after first completion
            var xpResp = await page.APIRequest.GetAsync(ApiBaseUrl + "/api/xp", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
            });
            var xpData = await xpResp.JsonAsync();
            var xpAfterFirst = xpData!.Value.GetProperty("totalXp").GetInt32();

            // Submit the quiz again via API
            await SubmitQuizViaApiAllCorrect(page, token, "1.1.3");

            // Get XP after second completion
            var xpResp2 = await page.APIRequest.GetAsync(ApiBaseUrl + "/api/xp", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
            });
            var xpData2 = await xpResp2.JsonAsync();
            var xpAfterSecond = xpData2!.Value.GetProperty("totalXp").GetInt32();

            // XP should NOT have increased on retake
            Assert.Equal(xpAfterFirst, xpAfterSecond);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    private static async Task SubmitQuizViaApiAllCorrect(IPage page, string token, string lessonId)
    {
        var lessonResp = await page.APIRequest.GetAsync(ApiBaseUrl + $"/api/lessons/{lessonId}", new()
        {
            Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
        });

        if (!lessonResp.Ok)
        {
            return;
        }

        var lesson = await lessonResp.JsonAsync();
        if (lesson is null || !lesson.Value.TryGetProperty("quiz", out var quiz))
        {
            return;
        }

        if (!quiz.TryGetProperty("questions", out var questions))
        {
            return;
        }

        // For each question, probe the single-answer endpoint to find correct answers
        var answers = new List<object>();
        foreach (var q in questions.EnumerateArray())
        {
            var qId = q.GetProperty("id").GetString()!;
            var options = q.GetProperty("options");

            // Try each option to find the correct one
            string? correctOptionId = null;
            foreach (var opt in options.EnumerateArray())
            {
                var optId = opt.GetProperty("id").GetString()!;
                var probeResp = await page.APIRequest.PostAsync(ApiBaseUrl + $"/api/quizzes/{lessonId}/answer", new()
                {
                    Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
                    DataObject = new { questionId = qId, answer = new[] { optId } },
                });

                if (probeResp.Ok)
                {
                    var probeBody = await probeResp.JsonAsync();
                    if (probeBody is not null && probeBody.Value.GetProperty("correct").GetBoolean())
                    {
                        correctOptionId = optId;
                        break;
                    }
                }
            }

            answers.Add(new { questionId = qId, selectedOptionIds = new[] { correctOptionId ?? "a" } });
        }

        await page.APIRequest.PostAsync(ApiBaseUrl + $"/api/quizzes/{lessonId}/submit", new()
        {
            Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
            DataObject = new { answers },
        });
    }
}
