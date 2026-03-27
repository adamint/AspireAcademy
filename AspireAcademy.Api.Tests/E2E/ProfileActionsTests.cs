using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class ProfileActionsTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task EditDisplayName_SaveRefreshPage_NewNamePersists()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("prfname");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page.GetByText(username)).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Open edit dialog
            var editBtn = page.Locator("button").Filter(new() { HasTextRegex = new Regex("edit profile", RegexOptions.IgnoreCase) });
            await Assertions.Expect(editBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await editBtn.ClickAsync();

            var dialog = page.Locator("[role='dialog']");
            await Assertions.Expect(dialog).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Change display name to something unique
            var newDisplayName = $"EditedName_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            var nameInput = dialog.Locator("input").First;
            await nameInput.ClearAsync();
            await nameInput.FillAsync(newDisplayName);

            // Save changes
            await dialog.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("save", RegexOptions.IgnoreCase) }).ClickAsync();
            await Assertions.Expect(dialog).Not.ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Wait for save to propagate
            await page.WaitForTimeoutAsync(2_000);

            // Refresh the page
            await page.ReloadAsync();

            // Verify the new display name persisted
            await Assertions.Expect(page.GetByText(newDisplayName)).ToBeVisibleAsync(new() { Timeout = 15_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task RandomizeAvatar_AvatarImageSrcChanges()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("prfavatar");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page.GetByText(username)).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Capture initial avatar state
            var avatarImg = page.Locator("img[alt]").First;
            string? initialSrc = null;
            if (await avatarImg.IsVisibleAsync())
            {
                initialSrc = await avatarImg.GetAttributeAsync("src");
            }

            // Click Randomize Avatar
            var randomizeBtn = page.Locator("button").Filter(new() { HasTextRegex = new Regex("randomize avatar", RegexOptions.IgnoreCase) });
            await Assertions.Expect(randomizeBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await randomizeBtn.ClickAsync();
            await page.WaitForTimeoutAsync(3_000);

            // Verify no error message
            await Assertions.Expect(page.GetByText(new Regex("failed to randomize", RegexOptions.IgnoreCase))).Not.ToBeVisibleAsync();

            // Avatar image src should have changed
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
                    Assert.NotNull(newSrc);
                }
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ViewAnotherUsersProfile_ShowsTheirInfo()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            // Register two users
            var userA = UniqueUser("prfviewA");
            var userB = UniqueUser("prfviewB");

            await RegisterUser(page, userA);

            // Register user B in a separate page context
            var pageB = await fixture.NewPageAsync();
            await RegisterUser(pageB, userB);

            // Get user B's ID via API
            var tokenB = await GetAuthToken(pageB);
            var meResp = await pageB.APIRequest.GetAsync(ApiBaseUrl + "/api/auth/me", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {tokenB}" },
            });
            var meData = await meResp.JsonAsync();
            var userBId = meData!.Value.GetProperty("id").GetString()!;
            await fixture.ClosePageAsync(pageB);

            // User A navigates to user B's profile
            await page.GotoAsync(fixture.WebBaseUrl + $"/users/{userBId}");

            // User B's display name or username should be visible
            await Assertions.Expect(page.GetByText(userB)).ToBeVisibleAsync(new() { Timeout = 15_000 });

            // Profile stats section visible
            await Assertions.Expect(page.GetByTestId("profile-stats")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // "Add Friend" button should be visible on another user's profile
            var addFriendBtn = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("add friend", RegexOptions.IgnoreCase) });
            await Assertions.Expect(addFriendBtn).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Should NOT see the "Edit Profile" button (it's another user's profile)
            var editBtn = page.Locator("button").Filter(new() { HasTextRegex = new Regex("edit profile", RegexOptions.IgnoreCase) });
            await Assertions.Expect(editBtn).Not.ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
