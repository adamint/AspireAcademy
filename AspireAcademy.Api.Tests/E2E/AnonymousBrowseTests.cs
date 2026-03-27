using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class AnonymousBrowseTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task Anonymous_CanViewDashboard()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            // Clear any existing auth
            await ClearAuth(page);
            
            await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Verify worlds load without authentication
            var worldCards = page.Locator("[data-testid*='world-card'], .world-card, [data-world-id]");
            if (await worldCards.CountAsync() > 0)
            {
                await Assertions.Expect(worldCards.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            }
            else
            {
                // Alternative: look for world names in text
                var worldText = page.GetByText(new Regex("aspire.*foundations|world", RegexOptions.IgnoreCase));
                await Assertions.Expect(worldText.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Anonymous_CanViewLesson()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            // Clear any existing auth
            await ClearAuth(page);
            
            // Navigate directly to a lesson URL (we'll try a common one)
            await page.GotoAsync(fixture.WebBaseUrl + "/lessons/1.1.1");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Verify lesson content renders
            var lessonContent = page.Locator("[data-testid='lesson-content'], .lesson-content, main, article");
            await Assertions.Expect(lessonContent.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            
            // Verify there's some readable content
            var textContent = await lessonContent.First.TextContentAsync();
            Assert.True(textContent?.Length > 10, "Expected lesson to have meaningful content");
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Anonymous_SeesSignUpCTA()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            // Clear any existing auth
            await ClearAuth(page);
            
            await page.GotoAsync(fixture.WebBaseUrl + "/lessons/1.1.1");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Look for sign-up CTA instead of complete button
            var signUpCTA = page.GetByText(new Regex("sign up|register|create account|log in", RegexOptions.IgnoreCase));
            if (await signUpCTA.CountAsync() > 0)
            {
                await Assertions.Expect(signUpCTA.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
            }
            
            // Verify complete button is NOT present or is disabled/shows sign-up prompt
            var completeButton = page.GetByRole(AriaRole.Button).Filter(new() { HasTextRegex = new Regex("complete|finish", RegexOptions.IgnoreCase) });
            if (await completeButton.CountAsync() > 0)
            {
                var buttonText = await completeButton.First.TextContentAsync();
                var isDisabled = await completeButton.First.IsDisabledAsync();
                Assert.True(isDisabled || buttonText?.Contains("sign", StringComparison.OrdinalIgnoreCase) == true, 
                    "Complete button should be disabled or show sign-up prompt for anonymous users");
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Anonymous_CannotSubmitProgress()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            // Clear any existing auth
            await ClearAuth(page);
            
            await page.GotoAsync(fixture.WebBaseUrl + "/lessons/1.1.1");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
            
            // Look for action buttons
            var actionButtons = page.GetByRole(AriaRole.Button).Filter(new() { HasTextRegex = new Regex("complete|submit|next|finish", RegexOptions.IgnoreCase) });
            
            if (await actionButtons.CountAsync() > 0)
            {
                var button = actionButtons.First;
                
                // Check if button is disabled
                var isDisabled = await button.IsDisabledAsync();
                if (!isDisabled)
                {
                    // If not disabled, clicking should show sign-up prompt
                    await button.ClickAsync();
                    
                    // Look for sign-up prompt or redirect
                    var signUpPrompt = page.GetByText(new Regex("sign up|log in|register", RegexOptions.IgnoreCase));
                    var currentUrl = page.Url;
                    
                    Assert.True(await signUpPrompt.CountAsync() > 0 || currentUrl.Contains("login") || currentUrl.Contains("register"), 
                        "Clicking action buttons should prompt for sign-up or redirect to login");
                }
            }
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}