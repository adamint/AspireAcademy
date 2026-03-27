using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class CertificatesTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    [Fact]
    public async Task Certificates_Renders()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("certs");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/certificates");
            
            // Verify certificates page loads
            await Assertions.Expect(page.GetByText(new Regex("certificates", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task Certificates_ShowsWorldCards()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("worldcerts");
            await RegisterUser(page, username);
            await page.GotoAsync(fixture.WebBaseUrl + "/certificates");
            
            // Verify world certificate cards appear
            await Assertions.Expect(page.GetByText(new Regex("world|foundations", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
            
            // Verify there are cards (some may be locked)
            var cards = page.Locator("[role='button'], .card, .certificate-card").Or(
                page.GetByText(new Regex("locked|unlocked|complete", RegexOptions.IgnoreCase))
            );
            await Assertions.Expect(cards.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(page); }
    }
}