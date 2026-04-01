using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Playwright;

namespace AspireAcademy.Api.Tests.E2E;

/// <summary>
/// Shared helpers for Playwright E2E tests — mirrors the TypeScript helpers.ts.
/// </summary>
internal static class E2EHelpers
{
    /// <summary>Base URL for the web frontend, set by the fixture.</summary>
    public static string WebBaseUrl { get; set; } = "";

    /// <summary>Base URL for the API server, set by the fixture.</summary>
    public static string ApiBaseUrl { get; set; } = "";

    private static readonly HttpClient s_apiClient = CreateApiClient();

    private static HttpClient CreateApiClient()
    {
        var client = new HttpClient();
        client.DefaultRequestHeaders.Add("X-Test-Client", "true");
        return client;
    }

    public static Task<HttpResponseMessage> SendApiRequestAsync(HttpRequestMessage request) => s_apiClient.SendAsync(request);

    public static string UniqueUser(string prefix = "e2e")
    {
        // Username limit: 3-30 alphanumeric + underscore
        // Format: {prefix}_{timestamp_last8}_{guid4} = prefix + 14 chars
        var ts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        var guid = Guid.NewGuid().ToString("N")[..4];
        var suffix = $"{ts[^8..]}_{guid}"; // 8 + 1 + 4 = 13 chars
        var maxPrefix = 30 - 1 - 13; // 16 chars max for prefix
        if (prefix.Length > maxPrefix)
        {
            prefix = prefix[..maxPrefix];
        }
        return $"{prefix}_{suffix}";
    }

    public static async Task RegisterUser(IPage page, string username, string password = "TestPassword1!")
    {
        // Try API-based registration first (fast and reliable)
        var registered = await TrySeedUserViaApi(page, username, password);
        if (registered)
        {
            return;
        }

        // Fallback to UI-based registration with retry
        for (var attempt = 0; attempt < 2; attempt++)
        {
            await page.GotoAsync(WebBaseUrl + "/register");
            await page.GetByTestId("register-form").WaitForAsync(new() { State = WaitForSelectorState.Visible, Timeout = 10_000 });
            await page.Locator("#reg-user").FillAsync(username);
            await page.Locator("#reg-email").FillAsync($"{username}@test.com");
            await page.Locator("#reg-display").FillAsync(username);
            await page.Locator("#reg-pass").FillAsync(password);
            await page.Locator("#reg-confirm").FillAsync(password);

            // Wait for API response after submit
            var responseTask = page.WaitForResponseAsync(resp =>
                resp.Url.Contains("/api/auth/register") && resp.Status > 0,
                new() { Timeout = 15_000 });

            await page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("create.*account", RegexOptions.IgnoreCase) }).ClickAsync();

            try
            {
                var response = await responseTask;
                if (response.Ok)
                {
                    // Handle persona selection step — skip it
                    var skipButton = page.GetByRole(AriaRole.Button, new() { NameRegex = new Regex("skip", RegexOptions.IgnoreCase) });
                    try
                    {
                        await skipButton.WaitForAsync(new() { State = WaitForSelectorState.Visible, Timeout = 5_000 });
                        await skipButton.ClickAsync();
                    }
                    catch
                    {
                        // Persona step may not appear if already selected
                    }
                    await Assertions.Expect(page).ToHaveURLAsync(new Regex("/dashboard"), new() { Timeout = 15_000 });
                    return;
                }
            }
            catch
            {
                // Timeout waiting for response, retry
            }
        }

        // Final assertion to give a clear error if all attempts failed
        await Assertions.Expect(page).ToHaveURLAsync(new Regex("/dashboard"), new() { Timeout = 15_000 });
    }

    /// <summary>
    /// Registers a user via the API and injects the auth token into the browser.
    /// Returns true if successful.
    /// </summary>
    public static async Task<bool> TrySeedUserViaApi(IPage page, string username, string password = "TestPassword1!")
    {
        try
        {
            var payload = new { username, email = $"{username}@test.com", displayName = username, password };
            var resp = await s_apiClient.PostAsJsonAsync(ApiBaseUrl + "/api/auth/register", payload);

            if (!resp.IsSuccessStatusCode)
            {
                Console.WriteLine($"[E2E] API register failed for {username}: {resp.StatusCode} - {await resp.Content.ReadAsStringAsync()}");
                return false;
            }

            var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
            var token = body.GetProperty("token").GetString();
            var userJson = body.GetProperty("user").GetRawText();

            // Navigate to any page to establish the origin for localStorage
            await page.GotoAsync(WebBaseUrl + "/login");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);

            // Inject auth state into localStorage (matches zustand persist format)
            await page.EvaluateAsync(@"([token, userJson]) => {
                const user = JSON.parse(userJson);
                const authState = {
                    state: { token, user, isAuthenticated: true },
                    version: 0
                };
                localStorage.setItem('aspire-learn-auth', JSON.stringify(authState));
            }", new object[] { token!, userJson });

            // Navigate to dashboard
            await page.GotoAsync(WebBaseUrl + "/dashboard");
            await Assertions.Expect(page).ToHaveURLAsync(new Regex("/dashboard"), new() { Timeout = 15_000 });
            Console.WriteLine($"[E2E] API seed SUCCESS for {username}");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[E2E] API seed EXCEPTION for {username}: {ex.Message}");
            return false;
        }
    }

    public static async Task LoginUser(IPage page, string username, string password = "TestPassword1!")
    {
        // Try API-based login first (fast and reliable)
        try
        {
            var payload = new { usernameOrEmail = username, password };
            var resp = await s_apiClient.PostAsJsonAsync(ApiBaseUrl + "/api/auth/login", payload);
            if (resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
                var token = body.GetProperty("token").GetString();
                var userJson = body.GetProperty("user").GetRawText();

                await page.GotoAsync(WebBaseUrl + "/login");
                await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);

                await page.EvaluateAsync(@"([token, userJson]) => {
                    const user = JSON.parse(userJson);
                    const authState = {
                        state: { token, user, isAuthenticated: true },
                        version: 0
                    };
                    localStorage.setItem('aspire-learn-auth', JSON.stringify(authState));
                }", new object[] { token!, userJson });

                await page.GotoAsync(WebBaseUrl + "/dashboard");
                await Assertions.Expect(page).ToHaveURLAsync(new Regex("/dashboard"), new() { Timeout = 15_000 });
                return;
            }
        }
        catch
        {
            // Fall through to UI login
        }

        // Fallback to UI-based login
        await page.GotoAsync(WebBaseUrl + "/login");
        await page.GetByTestId("login-form").WaitForAsync(new() { State = WaitForSelectorState.Visible, Timeout = 10_000 });
        await page.Locator("#login-user").FillAsync(username);
        await page.Locator("#login-pass").FillAsync(password);
        await page.GetByRole(AriaRole.Button, new() { NameRegex = new("log in", RegexOptions.IgnoreCase) }).ClickAsync();
        await Assertions.Expect(page).ToHaveURLAsync(new Regex("/dashboard"), new() { Timeout = 15_000 });
    }

    public static async Task LogoutUser(IPage page)
    {
        await page.GetByLabel("User menu").ClickAsync();
        await page.GetByText("Log Out").ClickAsync();
        await Assertions.Expect(page).ToHaveURLAsync(new Regex("/login"), new() { Timeout = 10_000 });
    }

    public static async Task ExpectDashboard(IPage page)
    {
        await Assertions.Expect(page).ToHaveURLAsync(new Regex(@"/(dashboard|$)"));
        await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
    }

    public static async Task ClearAuth(IPage page)
    {
        // Ensure we're on the app origin so localStorage is accessible
        if (page.Url.StartsWith("about:") || !page.Url.StartsWith("http"))
        {
            await page.GotoAsync(WebBaseUrl + "/login");
            await page.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
        }
        await page.EvaluateAsync("() => localStorage.removeItem('aspire-learn-auth')");
    }

    public static async Task NavigateToWorld(IPage page, string worldName = "The Distributed Problem")
    {
        await page.GetByRole(AriaRole.Main).GetByText(worldName).First.ClickAsync();
        await Assertions.Expect(page).ToHaveURLAsync(new Regex("/worlds/"), new() { Timeout = 10_000 });
        await Assertions.Expect(page.GetByText(new Regex("back to dashboard", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
    }

    public static async Task NavigateToFirstLearnLesson(IPage page)
    {
        var learnLesson = page.Locator("[role='button']").Filter(new() { HasText = "📖" });
        await Assertions.Expect(learnLesson.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        await learnLesson.First.ClickAsync();
        await Assertions.Expect(page).ToHaveURLAsync(new Regex("/lessons/"), new() { Timeout = 10_000 });
        await Assertions.Expect(page.GetByText(new Regex("back to", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
    }

    public static async Task LoginAndGoToDashboard(IPage page, string username)
    {
        await LoginUser(page, username);
        await ExpectDashboard(page);
    }

    public static async Task LoginAndGoToWorld(IPage page, string username, string worldName = "The Distributed Problem")
    {
        await LoginUser(page, username);
        await ExpectDashboard(page);
        await NavigateToWorld(page, worldName);
    }

    public static async Task LoginAndGoToFirstLesson(IPage page, string username)
    {
        await LoginAndGoToWorld(page, username);
        await NavigateToFirstLearnLesson(page);
    }

    public static async Task<string> GetAuthToken(IPage page)
    {
        var authJson = await page.EvaluateAsync<string>("() => localStorage.getItem('aspire-learn-auth')");
        using var doc = System.Text.Json.JsonDocument.Parse(authJson);
        return doc.RootElement.GetProperty("state").GetProperty("token").GetString()!;
    }

    public static async Task CompleteLearnLessonsViaApi(IPage page, params string[] lessonIds)
    {
        var token = await GetAuthToken(page);
        foreach (var lessonId in lessonIds)
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, ApiBaseUrl + "/api/progress/complete");
            req.Headers.Add("Authorization", $"Bearer {token}");
            req.Content = JsonContent.Create(new { lessonId });
            var resp = await s_apiClient.SendAsync(req);
            Console.WriteLine($"[E2E] Complete lesson {lessonId}: {resp.StatusCode}");

            // If the lesson isn't a 'learn' type (e.g. challenge), skip it instead to satisfy prereqs
            if (!resp.IsSuccessStatusCode)
            {
                using var skipReq = new HttpRequestMessage(HttpMethod.Post, ApiBaseUrl + "/api/progress/skip");
                skipReq.Headers.Add("Authorization", $"Bearer {token}");
                skipReq.Content = JsonContent.Create(new { lessonId });
                var skipResp = await s_apiClient.SendAsync(skipReq);
                Console.WriteLine($"[E2E] Skip lesson {lessonId} (fallback): {skipResp.StatusCode}");
            }
        }
    }

    public static async Task UnlockFirstChallenge(IPage page)
    {
        await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2", "1.1.2a");

        var token = await GetAuthToken(page);

        // Submit quiz 1.1.3
        await SubmitQuizViaApi(token, "1.1.3");
        // Submit boss 1.1-boss
        await SubmitQuizViaApi(token, "1.1-boss");

        await CompleteLearnLessonsViaApi(page, "1.2.1", "1.2.2", "1.2.3", "1.2.4");
    }

    private static async Task SubmitQuizViaApi(string token, string lessonId)
    {
        using var getReq = new HttpRequestMessage(HttpMethod.Get, ApiBaseUrl + $"/api/lessons/{lessonId}");
        getReq.Headers.Add("Authorization", $"Bearer {token}");
        var lessonResp = await s_apiClient.SendAsync(getReq);

        if (!lessonResp.IsSuccessStatusCode)
        {
            return;
        }

        var lesson = await lessonResp.Content.ReadFromJsonAsync<JsonElement>();
        if (!lesson.TryGetProperty("quiz", out var quiz))
        {
            return;
        }

        if (!quiz.TryGetProperty("questions", out var questions))
        {
            return;
        }

        var answers = new List<object>();
        foreach (var q in questions.EnumerateArray())
        {
            var qId = q.GetProperty("id").GetString();
            // Pick the first option as the answer (best effort)
            answers.Add(new { questionId = qId, selectedOptionIds = new[] { "b" } });
        }

        using var postReq = new HttpRequestMessage(HttpMethod.Post, ApiBaseUrl + $"/api/quizzes/{lessonId}/submit");
        postReq.Headers.Add("Authorization", $"Bearer {token}");
        postReq.Content = JsonContent.Create(new { answers });
        await s_apiClient.SendAsync(postReq);
    }
}

/// <summary>
/// Regex options helper to keep test code terse.
/// </summary>
internal static class RegexOptions
{
    public static System.Text.RegularExpressions.RegexOptions IgnoreCase =>
        System.Text.RegularExpressions.RegexOptions.IgnoreCase;
}

/// <summary>
/// Convenience re-export so tests can use `new Regex(...)` without extra usings.
/// </summary>
internal class Regex : System.Text.RegularExpressions.Regex
{
    public Regex(string pattern, System.Text.RegularExpressions.RegexOptions options = 0)
        : base(pattern, options)
    {
    }
}
