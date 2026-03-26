using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

/// <summary>
/// Full user journey: register → dashboard → world → lesson → quiz → profile → leaderboard → achievements → sidebar → theme.
/// </summary>
[Collection("AppHost")]
[Trait("Category", "E2E")]
public class FullUserJourneyTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task CompleteFirstSessionUserJourney()
    {
        var page = await fixture.NewPageAsync();
        page.SetDefaultTimeout(120_000);

        var username = $"journey_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
        var email = $"{username}@test.com";
        var password = "TestPassword1!";
        var displayName = $"Hero {username[^6..]}";
        var consoleErrors = new List<string>();

        page.Console += (_, msg) =>
        {
            if (msg.Type == "error")
            {
                consoleErrors.Add(msg.Text);
            }
        };

        try
        {
            // Step 1: Navigate to app → see login page
            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForURLAsync("**/login", new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText("Aspire Academy")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText("Welcome back, adventurer!")).ToBeVisibleAsync();
            await AssertNoFatalError(page);

            // Step 2: Click Register link → see register form
            await page.GetByRole(AriaRole.Link, new() { Name = "Register" }).ClickAsync();
            await page.WaitForURLAsync("**/register", new() { Timeout = 5_000 });
            await Assertions.Expect(page.GetByText("Create your hero account")).ToBeVisibleAsync();
            await Assertions.Expect(page.Locator("#reg-user")).ToBeVisibleAsync();

            // Step 3: Fill in registration form
            await page.Locator("#reg-user").FillAsync(username);
            await page.Locator("#reg-email").FillAsync(email);
            await page.Locator("#reg-display").FillAsync(displayName);
            await page.Locator("#reg-pass").FillAsync(password);
            await page.Locator("#reg-confirm").FillAsync(password);

            // Step 4: Submit registration → redirect to dashboard
            await page.GetByRole(AriaRole.Button, new() { Name = "Create Account" }).ClickAsync();
            await page.WaitForURLAsync("**/{dashboard,}", new() { Timeout = 15_000 });
            await AssertNoFatalError(page);

            // Step 5: Dashboard shows welcome message
            await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByRole(AriaRole.Heading, new() { Level = 1 })).ToContainTextAsync(displayName);

            // Step 6: Dashboard shows world cards
            await Assertions.Expect(page.GetByText("🌍 Your Worlds")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByRole(AriaRole.Main).GetByText("Aspire Foundations")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Step 7: XP bar shows Level 1
            await Assertions.Expect(page.GetByText("Lvl 1")).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await Assertions.Expect(page.Locator(".xp-bar-track")).ToBeVisibleAsync();

            // Step 8: Click world card → see module list
            await page.GetByRole(AriaRole.Main).GetByText("Aspire Foundations").ClickAsync();
            await page.WaitForURLAsync("**/worlds/**", new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText(new Regex("back to dashboard", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Step 9: First module with lessons visible
            await Assertions.Expect(page.GetByText("Why Aspire?")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var lessonItems = page.Locator("[role='button']").Filter(new() { HasText = "XP" });
            await Assertions.Expect(lessonItems.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            Assert.True(await lessonItems.CountAsync() >= 1);

            // Step 10: First lesson is unlocked
            var firstLesson = page.Locator("[role='button']").Filter(new() { HasText = "📖" }).First;
            await Assertions.Expect(firstLesson).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await Assertions.Expect(firstLesson).ToContainTextAsync("○");

            // Step 11: Click first lesson → see content
            await firstLesson.ClickAsync();
            await page.WaitForURLAsync("**/lessons/**", new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText(new Regex("back to", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await AssertNoFatalError(page);

            // Step 12: Mark Complete button visible and enabled
            var markBtn = page.GetByTestId("mark-complete-btn");
            await Assertions.Expect(markBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await Assertions.Expect(markBtn).ToBeEnabledAsync();

            // Step 13: Click Mark Complete → success
            await markBtn.ClickAsync();
            await AssertNoFatalError(page);

            // Step 14: Button shows Completed and is disabled
            await Assertions.Expect(markBtn).ToContainTextAsync("Completed", new() { Timeout = 10_000 });
            await Assertions.Expect(markBtn).ToBeDisabledAsync();

            // Step 15: XP bar shows updated XP
            await page.WaitForTimeoutAsync(1_000);
            var xpCounter = page.GetByText(new Regex("/500"));
            await Assertions.Expect(xpCounter).ToBeVisibleAsync(new() { Timeout = 5_000 });
            var xpValue = await xpCounter.TextContentAsync();
            var match = System.Text.RegularExpressions.Regex.Match(xpValue!, @"(\d+)/500");
            Assert.True(match.Success);
            Assert.True(int.Parse(match.Groups[1].Value) > 0);

            // Step 16: Click Next → second lesson
            var prevNextButtons = page.Locator("button:has(svg)").Filter(new() { HasNotTextRegex = new Regex("mark complete|skip|completed|back to", RegexOptions.IgnoreCase) });
            var nextBtn = prevNextButtons.Last;
            await Assertions.Expect(nextBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });
            await nextBtn.ClickAsync();
            await page.WaitForURLAsync("**/lessons/**", new() { Timeout = 10_000 });

            // Step 17: Second lesson content visible
            await Assertions.Expect(page.GetByText(new Regex("back to", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Step 18: Click back → module page
            await page.GetByText(new Regex("back to", RegexOptions.IgnoreCase)).ClickAsync();
            await page.WaitForURLAsync("**/worlds/**", new() { Timeout = 10_000 });

            // Step 19: First lesson shows completed ✅ icon
            var completedLesson = page.Locator("[role='button']").Filter(new() { HasText = "✅" }).First;
            await Assertions.Expect(completedLesson).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Step 20: Navigate to quiz (completing prereqs via API)
            var token = await GetAuthToken(page);
            await page.APIRequest.PostAsync(fixture.ApiBaseUrl + "/api/progress/complete", new()
            {
                Headers = new Dictionary<string, string>
                {
                    ["Authorization"] = $"Bearer {token}",
                    ["Content-Type"] = "application/json",
                    ["X-Test-Client"] = "true",
                },
                DataObject = new { lessonId = "1.1.2" },
            });
            await page.GotoAsync(fixture.WebBaseUrl + "/quizzes/1.1.3");
            await page.WaitForURLAsync("**/quizzes/**", new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByTestId("quiz-submit")).ToBeVisibleAsync(new() { Timeout = 15_000 });

            // Step 21: Quiz shows question with options
            await Assertions.Expect(page.GetByText(new Regex("question 1 of", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Step 22: Select an answer option
            var submitBtn = page.GetByTestId("quiz-submit");
            var radio = page.Locator("input[type='radio']").First;
            if (await radio.IsVisibleAsync())
            {
                await radio.ClickAsync(new() { Force = true });
            }

            await Assertions.Expect(submitBtn).ToBeEnabledAsync(new() { Timeout = 5_000 });

            // Step 23: Submit answer → see feedback
            await submitBtn.ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex("correct|incorrect", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("next question|see results", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Step 24: Complete all quiz questions
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

                await page.WaitForTimeoutAsync(500);
            }

            // Step 25: Quiz results visible with score
            await Assertions.Expect(page.GetByText("— Results")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText(new Regex("PASSED|FAILED"))).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await Assertions.Expect(page.GetByText("Q1")).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Step 26: Navigate to profile → see stats
            var sidebar = page.GetByRole(AriaRole.Navigation);
            await sidebar.GetByText("Profile").ClickAsync();
            await page.WaitForURLAsync("**/profile", new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText(displayName)).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText("Total XP")).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Step 27: Leaderboard shows entries
            await sidebar.GetByText("Leaderboard").ClickAsync();
            await page.WaitForURLAsync("**/leaderboard", new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText("🏆 Leaderboard")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Step 28: Achievements page renders
            await sidebar.GetByText("Achievements").ClickAsync();
            await page.WaitForURLAsync("**/achievements", new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText("🎖️ Achievements")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Step 29: Sidebar world dropdown expands
            await Assertions.Expect(sidebar.GetByText("Aspire Foundations")).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await sidebar.GetByText("Aspire Foundations").ClickAsync();
            await Assertions.Expect(sidebar.GetByText("Why Aspire?")).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Step 30: Theme toggle switches theme
            var themeBtn = page.GetByLabel("Toggle color mode");
            await Assertions.Expect(themeBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            var initialBg = await page.EvaluateAsync<string>("() => getComputedStyle(document.body).backgroundColor");
            await themeBtn.ClickAsync();
            await page.WaitForTimeoutAsync(500);
            var newBg = await page.EvaluateAsync<string>("() => getComputedStyle(document.body).backgroundColor");
            Assert.NotEqual(initialBg, newBg);

            // Final: no 500/fatal errors in console
            var fatalErrors = consoleErrors.Where(e => e.Contains("500") || e.Contains("Internal Server Error")).ToList();
            Assert.Empty(fatalErrors);
        }
        finally
        {
            await page.CloseAsync();
        }
    }

    private static async Task AssertNoFatalError(IPage page)
    {
        var body = page.Locator("body");
        await Assertions.Expect(body).Not.ToContainTextAsync("Something went wrong");
        await Assertions.Expect(body).Not.ToContainTextAsync("Internal Server Error");
    }
}
