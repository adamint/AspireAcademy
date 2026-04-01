using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class SidebarTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task SidebarShowsWorldsSectionWithWorldNames()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("sidebar");
            await RegisterUser(page, username);
            var sidebar = page.GetByRole(AriaRole.Navigation);
            await Assertions.Expect(sidebar.GetByText("Worlds")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(sidebar.GetByText("The Distributed Problem")).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickingUnlockedWorldExpandsToShowModules()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("sideexpand");
            await RegisterUser(page, username);
            var sidebar = page.GetByRole(AriaRole.Navigation);
            await Assertions.Expect(sidebar.GetByText("The Distributed Problem")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await sidebar.GetByText("The Distributed Problem").ClickAsync();
            await Assertions.Expect(sidebar.GetByText("Why Distributed Apps Are Hard")).ToBeVisibleAsync(new() { Timeout = 5_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickingExpandedWorldCollapsesModules()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("sidecollapse");
            await RegisterUser(page, username);
            var sidebar = page.GetByRole(AriaRole.Navigation);
            await Assertions.Expect(sidebar.GetByText("The Distributed Problem")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            await sidebar.GetByText("The Distributed Problem").ClickAsync();
            await Assertions.Expect(sidebar.GetByText("Why Distributed Apps Are Hard")).ToBeVisibleAsync(new() { Timeout = 5_000 });

            await sidebar.GetByText("The Distributed Problem").ClickAsync();
            await Assertions.Expect(sidebar.GetByText("Why Distributed Apps Are Hard")).Not.ToBeVisibleAsync(new() { Timeout = 3_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ClickingModuleNavigatesToWorldPage()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("sidenav");
            await RegisterUser(page, username);
            var sidebar = page.GetByRole(AriaRole.Navigation);
            await Assertions.Expect(sidebar.GetByText("The Distributed Problem")).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await sidebar.GetByText("The Distributed Problem").ClickAsync();
            await Assertions.Expect(sidebar.GetByText("Why Distributed Apps Are Hard")).ToBeVisibleAsync(new() { Timeout = 5_000 });
            await sidebar.GetByText("Why Distributed Apps Are Hard").ClickAsync();
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/worlds/"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
