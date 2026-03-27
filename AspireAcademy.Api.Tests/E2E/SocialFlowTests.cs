using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class SocialFlowTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task FullFriendLifecycle_RequestAcceptListRemove()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var userA = UniqueUser("socA");
            var userB = UniqueUser("socB");

            // Register both users
            await RegisterUser(page, userA);
            var tokenA = await GetAuthToken(page);

            var pageB = await fixture.NewPageAsync();
            await RegisterUser(pageB, userB);
            var tokenB = await GetAuthToken(pageB);

            // User A sends friend request to User B via API
            var requestResp = await page.APIRequest.PostAsync(ApiBaseUrl + "/api/friends/request", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {tokenA}" },
                DataObject = new { username = userB },
            });
            Assert.True(requestResp.Ok || requestResp.Status == 201, $"Friend request failed: {requestResp.Status}");
            var requestBody = await requestResp.JsonAsync();
            var friendshipId = requestBody!.Value.GetProperty("friendshipId").GetString();

            // User B accepts the request via API
            var acceptResp = await pageB.APIRequest.PostAsync(ApiBaseUrl + $"/api/friends/{friendshipId}/accept", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {tokenB}" },
            });
            Assert.True(acceptResp.Ok, $"Accept failed: {acceptResp.Status}");

            // User A goes to friends page — User B should appear in the friends list
            await page.GotoAsync(fixture.WebBaseUrl + "/friends");
            var friendsTab = page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("^friends", RegexOptions.IgnoreCase) });
            await Assertions.Expect(friendsTab).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await friendsTab.ClickAsync();
            await page.WaitForTimeoutAsync(2_000);

            // User B should be in the friends list
            await Assertions.Expect(page.GetByText(userB)).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Remove the friend via API
            var removeResp = await page.APIRequest.DeleteAsync(ApiBaseUrl + $"/api/friends/{friendshipId}", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {tokenA}" },
            });
            Assert.True(removeResp.Ok || removeResp.Status == 204, $"Remove failed: {removeResp.Status}");

            // Reload friends page — user B should be gone
            await page.ReloadAsync();
            await Assertions.Expect(friendsTab).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await friendsTab.ClickAsync();
            await page.WaitForTimeoutAsync(2_000);

            // User B's name should no longer appear in the friends list
            // (may still appear in search results, but not under Friends tab)
            var friendEntries = page.Locator("[class*='css']").Filter(new() { HasText = userB });
            // Check that there are no friend cards with user B's name
            var friendBVisible = await page.GetByText(new Regex($"^{System.Text.RegularExpressions.Regex.Escape(userB)}$")).IsVisibleAsync();
            Assert.False(friendBVisible, "User B should no longer appear in the friends list after removal");

            await fixture.ClosePageAsync(pageB);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task CannotFriendYourself_ErrorShown()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("socself");
            await RegisterUser(page, username);
            var token = await GetAuthToken(page);

            // Try to send friend request to yourself via API
            var resp = await page.APIRequest.PostAsync(ApiBaseUrl + "/api/friends/request", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
                DataObject = new { username },
            });

            // Should fail — cannot friend yourself
            Assert.True(resp.Status == 400 || resp.Status == 409,
                $"Friending yourself should return 400 or 409, got {resp.Status}");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task DeclineFriendRequest_RemovedFromPending()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var userA = UniqueUser("socdecA");
            var userB = UniqueUser("socdecB");

            await RegisterUser(page, userA);
            var tokenA = await GetAuthToken(page);

            var pageB = await fixture.NewPageAsync();
            await RegisterUser(pageB, userB);
            var tokenB = await GetAuthToken(pageB);

            // User A sends friend request to User B
            var requestResp = await page.APIRequest.PostAsync(ApiBaseUrl + "/api/friends/request", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {tokenA}" },
                DataObject = new { username = userB },
            });
            Assert.True(requestResp.Ok || requestResp.Status == 201);
            var requestBody = await requestResp.JsonAsync();
            var friendshipId = requestBody!.Value.GetProperty("friendshipId").GetString();

            // User B declines the request (DELETE the friendship)
            var declineResp = await pageB.APIRequest.DeleteAsync(ApiBaseUrl + $"/api/friends/{friendshipId}", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {tokenB}" },
            });
            Assert.True(declineResp.Ok || declineResp.Status == 204, $"Decline failed: {declineResp.Status}");

            // Verify the pending request is gone via API
            var friendsResp = await pageB.APIRequest.GetAsync(ApiBaseUrl + "/api/friends", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {tokenB}" },
            });
            var friendsData = await friendsResp.JsonAsync();
            var pendingReceived = friendsData!.Value.GetProperty("pendingReceived");
            Assert.Equal(0, pendingReceived.GetArrayLength());

            await fixture.ClosePageAsync(pageB);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task UserAppearsInAllTimeLeaderboard_AfterEarningXp()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("soclb");
            await RegisterUser(page, username);

            // Earn XP by completing a lesson
            await CompleteLearnLessonsViaApi(page, "1.1.1");

            // Navigate to leaderboard all-time tab
            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");
            var allTimeTab = page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("all-time", RegexOptions.IgnoreCase) });
            await Assertions.Expect(allTimeTab).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await allTimeTab.ClickAsync();
            await page.WaitForTimeoutAsync(5_000);

            // User should appear in the leaderboard — look for "(you)" marker, rank footer, or username
            var userEntry = page.GetByText(new Regex(@"\(you\)", RegexOptions.IgnoreCase));
            var hasYouMarker = await userEntry.IsVisibleAsync();

            var rankFooter = page.GetByText(new Regex(@"your rank", RegexOptions.IgnoreCase));
            var hasRankFooter = await rankFooter.IsVisibleAsync();

            var hasUsername = await page.GetByText(username).IsVisibleAsync();

            Assert.True(hasYouMarker || hasRankFooter || hasUsername,
                $"User '{username}' should appear in all-time leaderboard after earning XP");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task AchievementUnlocks_AfterCompletingFirstLesson()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("socach");
            await RegisterUser(page, username);
            var token = await GetAuthToken(page);

            // Check achievements before — "First Steps" should be locked
            var beforeResp = await page.APIRequest.GetAsync(ApiBaseUrl + "/api/achievements", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
            });
            var beforeData = await beforeResp.JsonAsync();
            var unlockedBefore = 0;
            foreach (var a in beforeData!.Value.EnumerateArray())
            {
                if (a.GetProperty("isUnlocked").GetBoolean())
                {
                    unlockedBefore++;
                }
            }

            // Complete the first lesson
            await CompleteLearnLessonsViaApi(page, "1.1.1");

            // Check achievements after — at least one more should be unlocked
            var afterResp = await page.APIRequest.GetAsync(ApiBaseUrl + "/api/achievements", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
            });
            var afterData = await afterResp.JsonAsync();
            var unlockedAfter = 0;
            foreach (var a in afterData!.Value.EnumerateArray())
            {
                if (a.GetProperty("isUnlocked").GetBoolean())
                {
                    unlockedAfter++;
                }
            }

            Assert.True(unlockedAfter > unlockedBefore,
                $"At least one achievement should unlock after completing the first lesson: before={unlockedBefore}, after={unlockedAfter}");

            // Also verify in the UI — go to achievements page
            await page.GotoAsync(fixture.WebBaseUrl + "/achievements");
            await Assertions.Expect(page.GetByText("🎖️ Achievements")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // The "X of Y unlocked" count should show at least 1 unlocked
            var unlockedText = page.GetByText(new Regex(@"(\d+) of \d+ unlocked", RegexOptions.IgnoreCase));
            await Assertions.Expect(unlockedText).ToBeVisibleAsync(new() { Timeout = 5_000 });
            var text = await unlockedText.TextContentAsync();
            var match = System.Text.RegularExpressions.Regex.Match(text!, @"(\d+) of");
            var unlockedCount = int.Parse(match.Groups[1].Value);
            Assert.True(unlockedCount >= 1, "At least 1 achievement should be unlocked");
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
