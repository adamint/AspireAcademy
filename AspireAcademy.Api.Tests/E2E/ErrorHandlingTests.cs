using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class ErrorHandlingTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task InvalidLessonId_ShowsErrorState()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("errlesson2");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/lessons/invalid-lesson-id-xyz");

            // Should show error/not-found state, not a crash
            await Assertions.Expect(page.GetByText(new Regex("lesson not found|not found|error|failed", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Page should not show "Something went wrong" crash screen
            await Assertions.Expect(page.Locator("body")).Not.ToContainTextAsync("Internal Server Error");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task InvalidWorldId_ShowsErrorState()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("errworld2");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/worlds/nonexistent-world-xyz");

            // Should show error/not-found state
            await Assertions.Expect(page.GetByText(new Regex("world not found|not found|error", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // No crash
            await Assertions.Expect(page.Locator("body")).Not.ToContainTextAsync("Internal Server Error");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task ProtectedPageWithoutAuth_RedirectsToLogin()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            // Navigate to a protected page without authentication
            await page.GotoAsync(fixture.WebBaseUrl + "/profile");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"), new() { Timeout = 10_000 });

            // Also verify friends redirects (protected route)
            await page.GotoAsync(fixture.WebBaseUrl + "/friends");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"), new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}
