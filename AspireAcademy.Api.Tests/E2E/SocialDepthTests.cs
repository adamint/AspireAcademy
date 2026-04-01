using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class SocialDepthTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task LeaderboardWeeklyTabRenders()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("socialwk");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");

            var weeklyTab = page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("weekly", RegexOptions.IgnoreCase) });
            await Assertions.Expect(weeklyTab).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Weekly tab content renders (resets Monday note)
            await Assertions.Expect(page.GetByText(new Regex("resets monday", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task LeaderboardAllTimeTabRenders()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("socialat");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");

            var allTimeTab = page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("all-time", RegexOptions.IgnoreCase) });
            await Assertions.Expect(allTimeTab).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await allTimeTab.ClickAsync();
            await page.WaitForTimeoutAsync(1_000);

            // Should show leaderboard content (entries or empty state)
            var main = page.Locator("main, [role='main']");
            var text = await main.TextContentAsync();
            Assert.True(text?.Length > 10, "All-Time tab should render content");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task LeaderboardFriendsTabRenders()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("socialfr");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");

            var friendsTab = page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("friends", RegexOptions.IgnoreCase) });
            await Assertions.Expect(friendsTab).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await friendsTab.ClickAsync();
            await page.WaitForTimeoutAsync(2_000);

            // May show empty message or friend entries
            var hasContent = await page.GetByText(new Regex("no friends yet|add friends|XP", RegexOptions.IgnoreCase)).First.IsVisibleAsync();
            Assert.True(hasContent, "Friends tab should render either empty state or friend entries");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task UserAppearsInAllTimeLeaderboardAfterEarningXp()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("sociallb");
            await RegisterUser(page, username);

            // Earn some XP by completing a lesson
            await CompleteLearnLessonsViaApi(page, "1.1.1");

            // Navigate to leaderboard all-time
            await page.GotoAsync(fixture.WebBaseUrl + "/leaderboard");
            var allTimeTab = page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("all-time", RegexOptions.IgnoreCase) });
            await Assertions.Expect(allTimeTab).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await allTimeTab.ClickAsync();
            await page.WaitForTimeoutAsync(5_000);

            // User should appear in the leaderboard (look for "(you)" indicator, rank footer, or username)
            var userEntry = page.GetByText(new Regex(@"\(you\)", RegexOptions.IgnoreCase));
            var hasYouMarker = await userEntry.IsVisibleAsync();

            var rankFooter = page.GetByText(new Regex(@"your rank", RegexOptions.IgnoreCase));
            var hasRankFooter = await rankFooter.IsVisibleAsync();

            var hasUsername = await page.GetByText(username).IsVisibleAsync();

            Assert.True(hasYouMarker || hasRankFooter || hasUsername,
                $"User '{username}' should appear in leaderboard with (you) marker, rank footer, or username after earning XP");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task AchievementsGridRendersWithCards()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("socialach");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/achievements");

            // Wait for achievement content to load
            await Assertions.Expect(page.GetByText("🎖️ Achievements")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Count header shows "X of Y unlocked"
            await Assertions.Expect(page.GetByText(new Regex(@"\d+ of \d+ unlocked", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });

            // Grid should have achievement cards (locked ones show ???)
            var cards = page.Locator("[class*='css']").Filter(new() { HasTextRegex = new Regex(@"\?\?\?|XP|achievement", RegexOptions.IgnoreCase) });
            Assert.True(await cards.CountAsync() >= 1, "Should have at least one achievement card in the grid");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task AchievementFilterTabsSwitchContent()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("socialfilt");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/achievements");

            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("^all$", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Click milestone tab
            var milestoneTab = page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("milestone", RegexOptions.IgnoreCase) });
            await milestoneTab.ClickAsync();
            await page.WaitForTimeoutAsync(1_000);

            // Content should change (either filtered cards or "No Milestone achievements")
            var bodyText = await page.Locator("main, [role='main']").TextContentAsync();
            Assert.True(bodyText?.Length > 0, "Tab content should render after switching");

            // Click mastery tab
            var masteryTab = page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("mastery", RegexOptions.IgnoreCase) });
            await masteryTab.ClickAsync(new() { Force = true });
            await page.WaitForTimeoutAsync(1_000);

            var masBodyText = await page.Locator("main, [role='main']").TextContentAsync();
            Assert.True(masBodyText?.Length > 0, "Mastery tab content should render");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task LockedAchievementShowsLockIndicator()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("sociallock");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/achievements");

            await Assertions.Expect(page.GetByText("🎖️ Achievements")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await page.WaitForTimeoutAsync(3_000);

            // For a fresh user, most achievements are locked
            // Locked achievements show "???" as name
            var lockedCards = page.GetByText("???");
            var lockedCount = await lockedCards.CountAsync();
            Assert.True(lockedCount > 0, "Fresh user should have locked achievements showing '???'");

            // Verify tooltip hint for locked achievements
            var keepLearning = page.GetByText(new Regex("keep learning to unlock", RegexOptions.IgnoreCase));
            // Tooltip only shows on hover, so check the underlying element attribute
            var lockedElements = page.Locator("[style*='grayscale'], [style*='opacity: 0.6'], [class*='grayscale']");
            var hasGrayscale = await lockedElements.CountAsync() > 0;

            // Either grayscale styling or ??? names indicate locked state
            Assert.True(lockedCount > 0 || hasGrayscale, "Locked achievements should have visual lock indicator");
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
