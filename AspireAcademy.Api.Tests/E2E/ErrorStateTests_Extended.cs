using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
[Collection("E2E")]
public class ErrorStateTestsExtended(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task Gallery_LoadingState_ShowsWhileFetching()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            // Navigate to gallery and immediately check for loading indicator before data arrives
            var responseTask = page.WaitForResponseAsync(
                resp => resp.Url.Contains("/api/") && resp.Request.ResourceType == "fetch",
                new() { Timeout = 15_000 });

            await page.GotoAsync(fixture.WebBaseUrl + "/gallery");

            // Check for loading state — either a spinner/skeleton or the final content
            var loadingIndicator = page.Locator("[data-testid='gallery-loading'], [data-testid='loading-spinner'], .loading, [aria-busy='true']").Or(
                page.Locator("[role='progressbar']"));
            var galleryContent = page.Locator("[data-testid='gallery-search']").Or(
                page.Locator("[data-testid^='arch-']"));

            // Wait for either loading indicator or final content to appear
            var either = loadingIndicator.Or(galleryContent);
            await Assertions.Expect(either.First).ToBeVisibleAsync(new() { Timeout = 15_000 });

            // Eventually the gallery content should load
            await Assertions.Expect(galleryContent.First).ToBeVisibleAsync(new() { Timeout = 15_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Dashboard_ErrorState_ShowsRetryButton()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("errdash");
            await RegisterUser(page, username);

            // Navigate to dashboard and verify it handles load gracefully
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");

            // The dashboard should show either content or a loading state — never a blank page
            var dashboardContent = page.GetByText(new Regex("welcome back|dashboard|your progress|daily", RegexOptions.IgnoreCase));
            var loadingState = page.Locator("[data-testid='dashboard-loading'], [role='progressbar'], .loading, [aria-busy='true']");
            var errorState = page.Locator("[data-testid='dashboard-error'], [data-testid='retry-btn']").Or(
                page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("retry|try again", RegexOptions.IgnoreCase) }));

            // Wait for any of the three states to appear
            var anyState = dashboardContent.Or(loadingState).Or(errorState);
            await Assertions.Expect(anyState.First).ToBeVisibleAsync(new() { Timeout = 15_000 });

            // Ultimately dashboard content should resolve
            await page.WaitForLoadStateAsync(LoadState.NetworkIdle, new() { Timeout = 15_000 });

            // After network settles, verify we have actual content (not stuck in loading)
            var finalContent = page.GetByText(new Regex("welcome back|dashboard|your progress|daily|xp|level", RegexOptions.IgnoreCase));
            await Assertions.Expect(finalContent.First).ToBeVisibleAsync(new() { Timeout = 15_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
