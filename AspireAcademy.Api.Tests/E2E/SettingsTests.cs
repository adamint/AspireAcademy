using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class SettingsTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task Settings_Renders()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("settings");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/settings");
            
            // Verify settings page loads and sections are visible
            await Assertions.Expect(page.GetByText(new Regex("settings", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Settings_ThemeToggle()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("theme");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/settings");
            
            // Verify theme toggle switch exists
            var themeToggle = page.Locator("[role='switch']").Or(page.GetByText(new Regex("theme", RegexOptions.IgnoreCase)));
            await Assertions.Expect(themeToggle.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Settings_ChangePasswordForm()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("password");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/settings");
            
            // Verify change password section has inputs
            await Assertions.Expect(page.GetByText(new Regex("password", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            
            // Look for password input fields
            var passwordInputs = page.Locator("input[type='password']");
            await Assertions.Expect(passwordInputs.First).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Settings_DangerZone()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("danger");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/settings");
            
            // Verify delete account section exists
            var dangerZone = page.GetByText(new Regex("delete.*account|danger.*zone", RegexOptions.IgnoreCase));
            await Assertions.Expect(dangerZone.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}