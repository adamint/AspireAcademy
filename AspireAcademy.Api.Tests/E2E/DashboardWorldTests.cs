using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class DashboardWorldTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task DashboardShowsWelcomeMessageAndWorldCards()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("dash");
            await RegisterUser(page, username);
            await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 15_000 });
            await Assertions.Expect(page.GetByRole(AriaRole.Main).GetByText("Aspire Foundations")).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickingWorldCardNavigatesToWorldPage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("dashclick");
            await RegisterUser(page, username);
            await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await page.GetByRole(AriaRole.Main).GetByText("Aspire Foundations").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/worlds/"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task DashboardShowsXpStats()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("dashxp");
            await RegisterUser(page, username);
            await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText(new Regex("level|xp", RegexOptions.IgnoreCase)).First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task WorldPageShowsModulesWithLessons()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("module");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await Assertions.Expect(page.GetByText("Why Aspire?")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            var lessonItems = page.Locator("[role='button']").Filter(new() { HasText = "XP" });
            Assert.True(await lessonItems.CountAsync() >= 1);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task WorldPageBackToDashboardWorks()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("worldback");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await page.GetByText("Back to Dashboard").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/dashboard"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task LessonListShowsCorrectTypeIcons()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("icons");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            var learnLessons = page.Locator("[role='button']").Filter(new() { HasText = "📖" });
            Assert.True(await learnLessons.CountAsync() >= 1);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickingLearnLessonNavigatesToLessonsPage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("lessonclick");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            var learnLesson = page.Locator("[role='button']").Filter(new() { HasText = "📖" });
            await Assertions.Expect(learnLesson.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await learnLesson.First.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/lessons/"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickingQuizLessonNavigatesToQuizzesPage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("quizclick");
            await RegisterUser(page, username);
            await UnlockFirstChallenge(page);
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await NavigateToWorld(page);

            var quizLesson = page.Locator("[role='button']").Filter(new() { HasText = "🧪" });
            if (await quizLesson.CountAsync() == 0)
            {
                return; // No quiz lessons visible
            }

            var firstQuiz = quizLesson.First;
            var text = await firstQuiz.TextContentAsync();
            if (text?.Contains("🔒") == true)
            {
                return; // Quiz lesson is locked
            }

            await firstQuiz.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/quizzes/"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickingChallengeLessonNavigatesToChallengesPage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("chalclick");
            await RegisterUser(page, username);
            await UnlockFirstChallenge(page);
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await NavigateToWorld(page);

            var challengeLesson = page.Locator("[role='button']").Filter(new() { HasTextRegex = new Regex("💻|🏗️|🎮") });
            if (await challengeLesson.CountAsync() == 0)
            {
                return; // No challenge lessons visible
            }

            await challengeLesson.First.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/challenges/"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
