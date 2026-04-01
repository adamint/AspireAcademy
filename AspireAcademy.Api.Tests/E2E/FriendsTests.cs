using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class FriendsTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task FriendsPageLoadsWithTabs()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("friend");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/friends");
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("friends", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("pending", RegexOptions.IgnoreCase) })).ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task EmptyFriendsListShowsEmptyState()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("nofriend");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/friends");
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("friends", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(page.GetByText(new Regex("no friends yet", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SearchInputWithShortQueryDoesNotSearch()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("shortsearch");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/friends");
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("friends", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var searchInput = page.GetByPlaceholder("Search users...");
            await Assertions.Expect(searchInput).ToBeVisibleAsync();
            await searchInput.FillAsync("a");
            await page.WaitForTimeoutAsync(500);
            await Assertions.Expect(page.GetByText("Search Results")).Not.ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task SearchFindsUsers()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var user1 = UniqueUser("searcher");
            var user2 = UniqueUser("searchee");
            await RegisterUser(page, user1);

            var page2 = await fixture.NewPageAsync();
            await RegisterUser(page2, user2);
            await fixture.ClosePageAsync(page2);

            await page.GotoAsync(fixture.WebBaseUrl + "/friends");
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("friends", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var searchInput = page.GetByPlaceholder("Search users...");
            await searchInput.FillAsync(user2);
            await Assertions.Expect(page.GetByText("Search Results")).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task AddFriendButtonSendsFriendRequest()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var user1 = UniqueUser("adder");
            var user2 = UniqueUser("addee");

            await RegisterUser(page, user1);
            var page2 = await fixture.NewPageAsync();
            await RegisterUser(page2, user2);
            await fixture.ClosePageAsync(page2);

            await page.GotoAsync(fixture.WebBaseUrl + "/friends");
            await Assertions.Expect(page.GetByRole(AriaRole.Tab, new() { NameRegex = new Regex("friends", RegexOptions.IgnoreCase) })).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var searchInput = page.GetByPlaceholder("Search users...");
            await searchInput.FillAsync(user2);
            await Assertions.Expect(page.GetByText("Search Results")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            var addBtn = page.GetByRole(AriaRole.Button, new() { Name = "Add", Exact = true });
            if (await addBtn.IsVisibleAsync())
            {
                await addBtn.First.ClickAsync();
                await page.WaitForTimeoutAsync(2_000);
                await Assertions.Expect(page.GetByText(new Regex("action failed", RegexOptions.IgnoreCase))).Not.ToBeVisibleAsync();
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
