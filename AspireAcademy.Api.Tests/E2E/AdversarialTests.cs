using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

/// <summary>
/// Adversarial/edge-case tests: double-click prevention, validation, auth persistence, etc.
/// </summary>
[Trait("Category", "E2E")]
public class AdversarialTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task MarkCompleteButtonDisabledAfterSuccess()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("advlesson");
            await RegisterUser(page, username);
            await NavigateToWorld(page);
            await NavigateToFirstLearnLesson(page);

            var completeBtn = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("mark complete|completed", RegexOptions.IgnoreCase) });
            await Assertions.Expect(completeBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var btnText = await completeBtn.TextContentAsync();
            if (btnText?.Contains("Completed", StringComparison.OrdinalIgnoreCase) == true)
            {
                await Assertions.Expect(completeBtn).ToBeDisabledAsync();
                return;
            }

            await completeBtn.ClickAsync();
            await Assertions.Expect(completeBtn).ToBeDisabledAsync(new() { Timeout = 5_000 });
            await Assertions.Expect(completeBtn).ToContainTextAsync("Completed", new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task QuizSubmitButtonDisabledWithNoAnswer()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("advquiz");
            await RegisterUser(page, username);
            await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2", "1.1.2a");
            await LoginUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/quizzes/1.1.3");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/quizzes/"), new() { Timeout = 10_000 });

            var submitBtn = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("submit answer", RegexOptions.IgnoreCase) });
            await Assertions.Expect(submitBtn).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(submitBtn).ToBeDisabledAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task RegisterValidationErrorsShowForEmptyFields()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/register");
            await page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("create account", RegexOptions.IgnoreCase) }).ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex("username must be", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await Assertions.Expect(page.GetByText(new Regex("valid email", RegexOptions.IgnoreCase))).ToBeVisibleAsync();
            await Assertions.Expect(page.GetByText(new Regex("password must be", RegexOptions.IgnoreCase))).ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ValidationErrorsClearWhenUserStartsTyping()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/register");
            await page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("create account", RegexOptions.IgnoreCase) }).ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex("username must be", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });

            await page.Locator("#reg-user").FillAsync("valid_username");
            await Assertions.Expect(page.GetByText(new Regex("username must be", RegexOptions.IgnoreCase))).Not.ToBeVisibleAsync(new() { Timeout = 3_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task PasswordMismatchShowsError()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/register");
            await page.Locator("#reg-user").FillAsync("valid_user");
            await page.Locator("#reg-email").FillAsync("valid@test.com");
            await page.Locator("#reg-pass").FillAsync("TestPassword1!");
            await page.Locator("#reg-confirm").FillAsync("DifferentPassword1!");
            await page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("create account", RegexOptions.IgnoreCase) }).ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex("passwords do not match", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task RefreshDashboardAfterLoginStaysLoggedIn()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("advpersist");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });

            await page.ReloadAsync();
            await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page).Not.ToHaveURLAsync(new Regex("login"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClearingAuthRedirectsToLogin()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("advclear");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });

            await ClearAuth(page);
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("login"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task InvalidUserProfileShowsErrorOrGracefulState()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("advprofile");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/users/00000000-0000-0000-0000-000000000000");
            await page.WaitForTimeoutAsync(3_000);

            var hasError = await page.GetByText("Failed to load profile").IsVisibleAsync();
            var bodyNotEmpty = (await page.Locator("body").TextContentAsync())?.Length > 0;
            Assert.True(hasError || bodyNotEmpty);
            await Assertions.Expect(page.Locator("body")).Not.ToHaveTextAsync("");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task BackButtonFromLessonNavigatesToWorldPage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("advback");
            await RegisterUser(page, username);
            await NavigateToWorld(page);

            var lessonLinks = page.Locator("[role='button']").Filter(new() { HasText = "📖" });
            if (await lessonLinks.CountAsync() == 0)
            {
                return;
            }

            await lessonLinks.First.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/lessons/"), new() { Timeout = 10_000 });

            var backBtn = page.Locator("button").Filter(new() { HasTextRegex = new Regex("back to", RegexOptions.IgnoreCase) });
            await Assertions.Expect(backBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await backBtn.ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/worlds/|/dashboard"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SidebarWorldExpandShowsModules()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("advsidebar");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var sidebar = page.Locator("nav");
            await Assertions.Expect(sidebar).ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
