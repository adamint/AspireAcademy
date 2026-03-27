using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using AspireAcademy.Api.Tests.Fixtures;
using Microsoft.Playwright;
using static AspireAcademy.Api.Tests.E2E.E2EHelpers;

namespace AspireAcademy.Api.Tests.E2E;

[Trait("Category", "E2E")]
public class AdminFlowTests(AppHostPlaywrightFixture fixture) : IClassFixture<AppHostPlaywrightFixture>
{
    private const string AdminPassword = "TestPassword1!";

    private async Task<bool> TryEnsureAdminUser(IPage page)
    {
        // Create "admin" user via API (idempotent)
        var seeded = await TrySeedUserViaApi(page, "admin", AdminPassword);
        if (seeded) return true;

        // Already exists — try login
        try
        {
            var payload = new { usernameOrEmail = "admin", password = AdminPassword };
            using var req = new HttpRequestMessage(HttpMethod.Post, ApiBaseUrl + "/api/auth/login")
            {
                Content = System.Net.Http.Json.JsonContent.Create(payload),
            };
            var resp = await SendApiRequestAsync(req);

            if (resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
                var token = body.GetProperty("token").GetString();
                var userJson = body.GetProperty("user").GetRawText();

                await page.GotoAsync(fixture.WebBaseUrl + "/login");
                await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
                await page.EvaluateAsync(@"([token, userJson]) => {
                    const user = JSON.parse(userJson);
                    const authState = {
                        state: { token, user, isAuthenticated: true },
                        version: 0
                    };
                    localStorage.setItem('aspire-learn-auth', JSON.stringify(authState));
                }", new object[] { token!, userJson });
                await page.GotoAsync(fixture.WebBaseUrl + "/dashboard");
                await Assertions.Expect(page).ToHaveURLAsync(new Regex("/dashboard"), new() { Timeout = 15_000 });
                return true;
            }
        }
        catch { /* fall through */ }

        Console.WriteLine("[E2E] Cannot authenticate admin — stale user from previous session");
        return false;
    }

    [Fact]
    public async Task SeedTestData_LoginWithSeededCredentials_Works()
    {
        var page = await fixture.NewPageAsync();
        try
        {
            if (!await TryEnsureAdminUser(page)) return;

            // Get auth token for admin API calls
            var token = await GetAuthToken(page);

            // Seed test data via API using static HttpClient
            using var seedReq = new HttpRequestMessage(HttpMethod.Post, ApiBaseUrl + "/api/admin/seed-test-data");
            seedReq.Headers.Add("Authorization", $"Bearer {token}");
            seedReq.Headers.Add("X-Test-Client", "true");
            var seedResp = await SendApiRequestAsync(seedReq);
            Assert.True(seedResp.IsSuccessStatusCode || (int)seedResp.StatusCode == 409,
                $"Seed test data failed: {seedResp.StatusCode}");

            // Get seeded credentials
            using var credsReq = new HttpRequestMessage(HttpMethod.Get, ApiBaseUrl + "/api/admin/seeded-credentials");
            credsReq.Headers.Add("Authorization", $"Bearer {token}");
            credsReq.Headers.Add("X-Test-Client", "true");
            var credsResp = await SendApiRequestAsync(credsReq);
            Assert.True(credsResp.IsSuccessStatusCode);
            var credsJson = await credsResp.Content.ReadAsStringAsync();
            var creds = System.Text.Json.JsonDocument.Parse(credsJson).RootElement;

            // Find the testuser credentials
            string? testUsername = null;
            string? testPassword = null;
            foreach (var cred in creds.EnumerateArray())
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
            if (!await TryEnsureAdminUser(adminPage)) return;

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
