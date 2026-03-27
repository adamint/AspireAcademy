using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Collection("AppHost")]
[Trait("Category", "E2E")]
public class AdminFlowTests(AppHostPlaywrightFixture fixture)
{
    private const string AdminPassword = "TestPassword1!";

    private async Task EnsureAdminUser(IPage page)
    {
        // Create "admin" user via API (idempotent)
        await page.APIRequest.PostAsync(fixture.ApiBaseUrl + "/api/auth/register", new()
        {
            Headers = new Dictionary<string, string> { ["X-Test-Client"] = "true" },
            DataObject = new
            {
                username = "admin",
                email = $"admin_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}@e2e-test.com",
                displayName = "Admin",
                password = AdminPassword,
            },
        });
    }

    [Fact]
    public async Task SeedTestData_LoginWithSeededCredentials_Works()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            await EnsureAdminUser(page);

            // Login as admin
            await LoginUser(page, "admin", AdminPassword);

            // Seed test data via API
            var token = await GetAuthToken(page);
            var seedResp = await page.APIRequest.PostAsync(fixture.ApiBaseUrl + "/api/admin/seed-test-data", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
            });
            // Seed may return 200 or 409 if already seeded
            Assert.True(seedResp.Ok || seedResp.Status == 409,
                $"Seed test data failed: {seedResp.Status}");

            // Get seeded credentials
            var credsResp = await page.APIRequest.GetAsync(fixture.ApiBaseUrl + "/api/admin/seeded-credentials", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
            });
            Assert.True(credsResp.Ok);
            var creds = await credsResp.JsonAsync();

            // Find the testuser credentials
            string? testUsername = null;
            string? testPassword = null;
            foreach (var cred in creds!.Value.EnumerateArray())
            {
                var u = cred.GetProperty("username").GetString();
                if (u == "testuser")
                {
                    testUsername = u;
                    testPassword = cred.GetProperty("password").GetString();
                    break;
                }
            }

            Assert.NotNull(testUsername);
            Assert.NotNull(testPassword);

            // Logout current user
            await LogoutUser(page);

            // Login with seeded credentials
            await LoginUser(page, testUsername!, testPassword!);
            await ExpectDashboard(page);
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task NonAdminNavigatingToAdmin_RedirectedToDashboard()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("admnonadm");
            await RegisterUser(page, username);

            // Navigate directly to /admin
            await page.GotoAsync(fixture.WebBaseUrl + "/admin");
            await page.WaitForTimeoutAsync(3_000);

            // Non-admin should be redirected away from /admin
            var isRedirected = !page.Url.Contains("/admin");
            var redirectedToDashboard = page.Url.Contains("/dashboard");

            // AdminRoute component redirects to /dashboard when username !== 'admin'
            Assert.True(isRedirected || redirectedToDashboard,
                $"Non-admin should be redirected from /admin. Current URL: {page.Url}");

            // Admin content should NOT be visible
            var adminHeader = page.GetByText("🛡️ Admin Dashboard");
            await Assertions.Expect(adminHeader).Not.ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(page); }
    }

    [Fact]
    public async Task AdminSeesAdminLinkInSidebar_NonAdminDoesNot()
    {
        // Test admin user sees the link
        var adminPage = await fixture.NewPageAsync();
        try
        {
            await EnsureAdminUser(adminPage);
            await LoginUser(adminPage, "admin", AdminPassword);

            var sidebar = adminPage.GetByRole(AriaRole.Navigation);
            await Assertions.Expect(sidebar.GetByText("Admin Panel")).ToBeVisibleAsync(new() { Timeout = 10_000 });
        }
        finally { await fixture.ClosePageAsync(adminPage); }

        // Test non-admin user does NOT see the link
        var userPage = await fixture.NewPageAsync();
        try
        {
            var username = UniqueUser("admnosee");
            await RegisterUser(userPage, username);

            var sidebar = userPage.GetByRole(AriaRole.Navigation);
            // Wait for sidebar to fully load
            await Assertions.Expect(sidebar.GetByText("Dashboard")).ToBeVisibleAsync(new() { Timeout = 10_000 });

            // Admin Panel link should NOT be visible
            await Assertions.Expect(sidebar.GetByText("Admin Panel")).Not.ToBeVisibleAsync();
        }
        finally { await fixture.ClosePageAsync(userPage); }
    }
}
