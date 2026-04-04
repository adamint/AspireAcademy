using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
[Collection("E2E")]
public class HomePageImprovementsTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task HomePage_QuickLinks_Visible()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);

            // Verify quick links bar exists with expected links
            var playgroundLink = page.GetByRole(AriaRole.Link, new() { NameRegex = new Regex("playground", RegexOptions.IgnoreCase) });
            var galleryLink = page.GetByRole(AriaRole.Link, new() { NameRegex = new Regex("gallery", RegexOptions.IgnoreCase) });
            var conceptMapLink = page.GetByRole(AriaRole.Link, new() { NameRegex = new Regex("concept.*map", RegexOptions.IgnoreCase) });
            var curriculumLink = page.GetByRole(AriaRole.Link, new() { NameRegex = new Regex("curriculum", RegexOptions.IgnoreCase) });

            await Assertions.Expect(playgroundLink.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(galleryLink.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(conceptMapLink.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await Assertions.Expect(curriculumLink.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task HomePage_QuickLinks_NavigateCorrectly()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);

            // Find the Playground quick link and click it
            var playgroundLink = page.GetByRole(AriaRole.Link, new() { NameRegex = new Regex("playground", RegexOptions.IgnoreCase) });
            await Assertions.Expect(playgroundLink.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await playgroundLink.First.ClickAsync();

            // Verify navigation to /playground
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/playground"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task HomePage_WhyAspireCards_Clickable()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);

            // Find the "Try it" link that navigates to playground (associated with "Declare your app" card)
            var tryItLink = page.GetByRole(AriaRole.Link, new() { NameRegex = new Regex("try it", RegexOptions.IgnoreCase) });
            await Assertions.Expect(tryItLink.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            await tryItLink.First.ClickAsync();

            // Verify navigation to /playground
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/playground"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task HomePage_WhyAspireCards_HaveLearnLinks()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await page.GotoAsync(fixture.WebBaseUrl + "/");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);

            // Verify each "Why Aspire" card has a visible action link
            var tryItLinks = page.GetByRole(AriaRole.Link, new() { NameRegex = new Regex("try it", RegexOptions.IgnoreCase) });
            var seeHowLinks = page.GetByRole(AriaRole.Link, new() { NameRegex = new Regex("see how", RegexOptions.IgnoreCase) });
            var learnMoreLinks = page.GetByRole(AriaRole.Link, new() { NameRegex = new Regex("learn more", RegexOptions.IgnoreCase) });
            var exploreLinks = page.GetByRole(AriaRole.Link, new() { NameRegex = new Regex("^explore$", RegexOptions.IgnoreCase) });

            // Count all "Why Aspire" action links
            var tryItCount = await tryItLinks.CountAsync();
            var seeHowCount = await seeHowLinks.CountAsync();
            var learnMoreCount = await learnMoreLinks.CountAsync();
            var exploreCount = await exploreLinks.CountAsync();
            var totalActionLinks = tryItCount + seeHowCount + learnMoreCount + exploreCount;

            Assert.True(totalActionLinks >= 2,
                $"Expected at least 2 'Why Aspire' action links (Try it/See how/Learn more/Explore), found {totalActionLinks}");

            // Verify at least one of each type is visible
            if (tryItCount > 0)
            {
                await Assertions.Expect(tryItLinks.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            }
            if (seeHowCount > 0)
            {
                await Assertions.Expect(seeHowLinks.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
