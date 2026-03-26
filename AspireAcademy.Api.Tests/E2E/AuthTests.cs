using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class AuthTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task RegisterWithValidData_RedirectsToDashboard()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("auth");
            await RegisterUser(page, username);
            await ExpectDashboard(page);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task RegisterWithEmptyUsername_ShowsValidationError()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/register");
            await page.Locator("#reg-email").FillAsync("empty@test.com");
            await page.Locator("#reg-pass").FillAsync("TestPassword1!");
            await page.Locator("#reg-confirm").FillAsync("TestPassword1!");
            await page.GetByRole(AriaRole.Button, new() { Name = "Create Account" }).ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex("username must be 3", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task RegisterWithEmptyEmail_ShowsValidationError()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/register");
            await page.Locator("#reg-user").FillAsync("validuser");
            await page.Locator("#reg-pass").FillAsync("TestPassword1!");
            await page.Locator("#reg-confirm").FillAsync("TestPassword1!");
            await page.GetByRole(AriaRole.Button, new() { Name = "Create Account" }).ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex("valid email", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task RegisterWithShortPassword_ShowsValidationError()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var user = UniqueUser("short");
            await page.GotoAsync(fixture.WebBaseUrl + "/register");
            await page.Locator("#reg-user").FillAsync(user);
            await page.Locator("#reg-email").FillAsync($"{user}@test.com");
            await page.Locator("#reg-pass").FillAsync("123");
            await page.Locator("#reg-confirm").FillAsync("123");
            await page.GetByRole(AriaRole.Button, new() { Name = "Create Account" }).ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex(@"password must be 8\+", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task RegisterWithMismatchedPasswords_ShowsValidationError()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var user = UniqueUser("mismatch");
            await page.GotoAsync(fixture.WebBaseUrl + "/register");
            await page.Locator("#reg-user").FillAsync(user);
            await page.Locator("#reg-email").FillAsync($"{user}@test.com");
            await page.Locator("#reg-pass").FillAsync("TestPassword1!");
            await page.Locator("#reg-confirm").FillAsync("DifferentPassword1!");
            await page.GetByRole(AriaRole.Button, new() { Name = "Create Account" }).ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex("passwords do not match", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task RegisterWithDuplicateUsername_ShowsServerError()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("dup");
            await RegisterUser(page, username);
            var page2 = await fixture.NewPageAsync();
            try
            {
                await page2.GotoAsync(fixture.WebBaseUrl + "/register");
                await page2.Locator("#reg-user").FillAsync(username);
                await page2.Locator("#reg-email").FillAsync($"dup_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}@test.com");
                await page2.Locator("#reg-display").FillAsync("DupUser");
                await page2.Locator("#reg-pass").FillAsync("TestPassword1!");
                await page2.Locator("#reg-confirm").FillAsync("TestPassword1!");
                await page2.GetByRole(AriaRole.Button, new() { Name = "Create Account" }).ClickAsync();
                await Assertions.Expect(page2.GetByText(new Regex("already taken|already exists|duplicate", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            }
            finally { await fixture.ClosePageAsync(page2); }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task LoginWithValidCredentials_RedirectsToDashboard()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("login");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/login");
            await LoginUser(page, username);
            await ExpectDashboard(page);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task LoginWithWrongPassword_ShowsErrorMessage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("wrongpw");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/login");
            await page.Locator("#login-user").FillAsync(username);
            await page.Locator("#login-pass").FillAsync("WrongPassword1!");
            await page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("log in", RegexOptions.IgnoreCase) }).ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex("invalid|incorrect|failed|wrong", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task LoginWithNonExistentUser_ShowsErrorMessage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/login");
            await page.Locator("#login-user").FillAsync("no_such_user_xyz_999");
            await page.Locator("#login-pass").FillAsync("TestPassword1!");
            await page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("log in", RegexOptions.IgnoreCase) }).ClickAsync();
            await Assertions.Expect(page.GetByText(new Regex("invalid|not found|failed|credentials", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task LoginWithEmptyFields_StaysOnLoginPage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/login");
            await page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("log in", RegexOptions.IgnoreCase) }).ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Logout_RedirectsToLogin()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("logout");
            await RegisterUser(page, username);
            await LogoutUser(page);
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task RefreshWhileLoggedIn_StaysOnDashboard()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("refresh");
            await RegisterUser(page, username);
            await ExpectDashboard(page);
            await page.ReloadAsync();
            await ExpectDashboard(page);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task VisitProtectedPageWhileLoggedOut_RedirectsToLogin()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/login");
            await ClearAuth(page);
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"));
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task VisitRegisterWhileLoggedIn_ShowsRegisterPage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("regvisit");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/register");
            await Assertions.Expect(page.GetByRole(AriaRole.Button, new() { Name = "Create Account" })).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
