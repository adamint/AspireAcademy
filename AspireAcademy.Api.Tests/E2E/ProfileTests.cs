using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class ProfileTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task ProfilePageShowsOwnUserInfo()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("profile");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page.GetByText(username)).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task EditProfileButtonOpensDialogWithFormFields()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("profedit");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page.GetByText(username)).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var editBtn = page.Locator("button").Filter(new() { HasTextRegex = new Regex("edit profile", RegexOptions.IgnoreCase) });
            await Assertions.Expect(editBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await editBtn.ClickAsync();

            var dialog = page.Locator("[role='dialog']");
            await Assertions.Expect(dialog).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await Assertions.Expect(dialog.GetByText("Display Name")).ToBeVisibleAsync();
            await Assertions.Expect(dialog.GetByText("Bio")).ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task CancelButtonClosesEditDialog()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("profcancel");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page.GetByText(username)).ToBeVisibleAsync(new() { Timeout = 10_000 });

            await page.Locator("button").Filter(new() { HasTextRegex = new Regex("edit profile", RegexOptions.IgnoreCase) }).ClickAsync();
            var dialog = page.Locator("[role='dialog']");
            await Assertions.Expect(dialog).ToBeVisibleAsync(new() { Timeout = 5_000 });

            await dialog.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("cancel", RegexOptions.IgnoreCase) }).ClickAsync();
            await Assertions.Expect(dialog).Not.ToBeVisibleAsync(new() { Timeout = 3_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task RandomizeAvatarButtonWorksWithoutError()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("profavatar");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page.GetByText(username)).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var randomizeBtn = page.Locator("button").Filter(new() { HasTextRegex = new Regex("randomize avatar", RegexOptions.IgnoreCase) });
            await Assertions.Expect(randomizeBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await randomizeBtn.ClickAsync();
            await page.WaitForTimeoutAsync(2_000);
            await Assertions.Expect(page.GetByText(new Regex("failed to randomize", RegexOptions.IgnoreCase))).Not.ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
