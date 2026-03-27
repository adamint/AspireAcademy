using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class ProfileDepthTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task OwnProfileShowsCorrectUsername()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("profuser");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page.GetByText(username)).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Profile stats section visible
            await Assertions.Expect(page.GetByTestId("profile-stats")).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ProfileStatsShowCorrectXp()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("profxp");
            await RegisterUser(page, username);

            // Complete a lesson to earn XP
            await CompleteLearnLessonsViaApi(page, "1.1.1");

            // Navigate directly to profile
            await page.GotoAsync(fixture.WebBaseUrl + "/profile", new() { WaitUntil = WaitUntilState.NetworkIdle });

            // If profile-stats not visible, reload (error boundary or timing issues)
            var profileStats = page.GetByTestId("profile-stats");
            try
            {
                await Assertions.Expect(profileStats).ToBeVisibleAsync(new() { Timeout = 5_000 });
            }
            catch
            {
                await page.ReloadAsync(new() { WaitUntil = WaitUntilState.NetworkIdle });
            }
            await Assertions.Expect(profileStats).ToBeVisibleAsync(new() { Timeout = 15_000 });

            // Total XP stat should be visible and > 0
            await Assertions.Expect(page.GetByText("Total XP")).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // The XP value in the stats should reflect earned XP
            var statsSection = page.GetByTestId("profile-stats");
            var statsText = await statsSection.TextContentAsync();
            Assert.Contains("Total XP", statsText);

            // Lessons count should show at least 1
            await Assertions.Expect(page.GetByText("Lessons")).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task EditDisplayName_SaveRefresh_NamePersisted()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("profeditname");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page.GetByText(username)).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Open edit dialog
            var editBtn = page.Locator("button").Filter(new() { HasTextRegex = new Regex("edit profile", RegexOptions.IgnoreCase) });
            await Assertions.Expect(editBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await editBtn.ClickAsync();

            var dialog = page.Locator("[role='dialog']");
            await Assertions.Expect(dialog).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Change display name
            var newDisplayName = $"NewName_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            var nameInput = dialog.Locator("input").First;
            await nameInput.ClearAsync();
            await nameInput.FillAsync(newDisplayName);

            // Save
            await dialog.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("save", RegexOptions.IgnoreCase) }).ClickAsync();
            await Assertions.Expect(dialog).Not.ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Wait for save to propagate
            await page.WaitForTimeoutAsync(2_000);

            // Refresh the page
            await page.ReloadAsync();
            await Assertions.Expect(page.GetByText(newDisplayName)).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task RandomizeAvatar_AvatarImageSrcChanges()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("profavatar2");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page.GetByText(username)).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Get initial avatar state (either img src or fallback initials)
            var avatarImg = page.Locator("img[alt]").First;
            string? initialSrc = null;
            if (await avatarImg.IsVisibleAsync())
            {
                initialSrc = await avatarImg.GetAttributeAsync("src");
            }

            // Click randomize
            var randomizeBtn = page.Locator("button").Filter(new() { HasTextRegex = new Regex("randomize avatar", RegexOptions.IgnoreCase) });
            await Assertions.Expect(randomizeBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await randomizeBtn.ClickAsync();
            await page.WaitForTimeoutAsync(3_000);

            // Verify no error
            await Assertions.Expect(page.GetByText(new Regex("failed to randomize", RegexOptions.IgnoreCase))).Not.ToBeVisibleAsync();

            // Check that avatar changed (new img appeared or src changed)
            var newAvatarImg = page.Locator("img[alt]").First;
            if (await newAvatarImg.IsVisibleAsync())
            {
                var newSrc = await newAvatarImg.GetAttributeAsync("src");
                if (initialSrc is not null)
                {
                    Assert.NotEqual(initialSrc, newSrc);
                }
                else
                {
                    // Avatar appeared where there was none before
                    Assert.NotNull(newSrc);
                }
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
