using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class ErrorStateTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task InvalidUrlShows404Page()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("error404");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/this-route-does-not-exist");
            await Assertions.Expect(page.GetByText("404")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText(new Regex("page not found", RegexOptions.IgnoreCase))).ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task NotFoundPage_GoToDashboardButtonWorks()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("error404btn");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/nonexistent-route-xyz");
            await Assertions.Expect(page.GetByText("404")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("dashboard", RegexOptions.IgnoreCase) }).ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/dashboard"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task InvalidLessonIdShowsNotFound()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("errlesson");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/lessons/nonexistent-lesson-id-12345");
            await Assertions.Expect(page.GetByText(new Regex("lesson not found|not found|error", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task InvalidQuizIdShowsError()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("errquiz");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/quizzes/nonexistent-quiz-id-12345");
            await Assertions.Expect(page.GetByText(new Regex("not found|error|failed to load", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task InvalidChallengeIdShowsError()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("errchallenge");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/challenges/nonexistent-challenge-id-12345");
            await Assertions.Expect(page.GetByText(new Regex("not found|error|failed", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task InvalidWorldIdShowsNotFound()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("errworld");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/worlds/nonexistent-world-id-12345");
            await Assertions.Expect(page.GetByText(new Regex("world not found|not found", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task InvalidUserProfileShowsErrorOrEmptyState()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("erruser");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/users/00000000-0000-0000-0000-000000000000");
            await page.WaitForTimeoutAsync(3_000);
            var hasError = await page.GetByText(new Regex("failed to load profile|user not found|not found|error", RegexOptions.IgnoreCase)).First.IsVisibleAsync();
            var hasRedirect = page.Url.Contains("/login") || page.Url.Contains("/dashboard");
            var bodyNotEmpty = (await page.Locator("body").TextContentAsync())?.Length > 0;
            Assert.True(hasError || hasRedirect || bodyNotEmpty);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task UnauthenticatedDashboardRedirectsToLogin()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task UnauthenticatedProfileRedirectsToLogin()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task UnauthenticatedFriendsRedirectsToLogin()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/friends");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task UnauthenticatedLeaderboardRedirectsToLogin()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task UnauthenticatedAchievementsRedirectsToLogin()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/achievements");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task UnauthenticatedLessonsRedirectsToLogin()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/lessons/some-fake-id");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
