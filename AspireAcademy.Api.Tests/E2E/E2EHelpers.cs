using Microsoft.Playwright;

namespace AspireAcademy.Api.Tests.E2E;

/// <summary>
/// Shared helpers for Playwright E2E tests — mirrors the TypeScript helpers.ts.
/// </summary>
internal static class E2EHelpers
{
    public static string UniqueUser(string prefix = "e2e")
    {
        return $"{prefix}_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}_{Guid.NewGuid().ToString("N")[..6]}";
    }

    public static async Task RegisterUser(IPage page, string username, string password = "TestPassword1!")
    {
        await page.GotoAsync("/register");
        await page.Locator("#reg-user").FillAsync(username);
        await page.Locator("#reg-email").FillAsync($"{username}@test.com");
        await page.Locator("#reg-display").FillAsync(username);
        await page.Locator("#reg-pass").FillAsync(password);
        await page.Locator("#reg-confirm").FillAsync(password);
        await page.GetByRole(AriaRole.Button, new() { Name = "Create Account" }).ClickAsync();
        await page.WaitForURLAsync("**/{dashboard,}", new() { Timeout = 15_000 });
    }

    public static async Task LoginUser(IPage page, string username, string password = "TestPassword1!")
    {
        await page.GotoAsync("/login");
        await page.Locator("#login-user").FillAsync(username);
        await page.Locator("#login-pass").FillAsync(password);
        await page.GetByRole(AriaRole.Button, new() { NameRegex = new("log in", RegexOptions.IgnoreCase) }).ClickAsync();
        await page.WaitForURLAsync("**/{dashboard,}", new() { Timeout = 15_000 });
    }

    public static async Task LogoutUser(IPage page)
    {
        await page.GetByLabel("User menu").ClickAsync();
        await page.GetByText("Log Out").ClickAsync();
        await page.WaitForURLAsync("**/login", new() { Timeout = 10_000 });
    }

    public static async Task ExpectDashboard(IPage page)
    {
        await Assertions.Expect(page).ToHaveURLAsync(new Regex(@"/(dashboard|$)"));
        await Assertions.Expect(page.GetByText(new Regex("welcome back", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
    }

    public static async Task ClearAuth(IPage page)
    {
        await page.EvaluateAsync("() => localStorage.removeItem('aspire-academy-auth')");
    }

    public static async Task NavigateToWorld(IPage page, string worldName = "Aspire Foundations")
    {
        await page.GetByRole(AriaRole.Main).GetByText(worldName).ClickAsync();
        await page.WaitForURLAsync("**/worlds/**");
        await Assertions.Expect(page.GetByText(new Regex("back to dashboard", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
    }

    public static async Task NavigateToFirstLearnLesson(IPage page)
    {
        var learnLesson = page.Locator("[role='button']").Filter(new() { HasText = "📖" });
        await Assertions.Expect(learnLesson.First).ToBeVisibleAsync(new() { Timeout = 10_000 });
        await learnLesson.First.ClickAsync();
        await page.WaitForURLAsync("**/lessons/**");
        await Assertions.Expect(page.GetByText(new Regex("back to", RegexOptions.IgnoreCase))).ToBeVisibleAsync(new() { Timeout = 10_000 });
    }

    public static async Task LoginAndGoToDashboard(IPage page, string username)
    {
        await LoginUser(page, username);
        await ExpectDashboard(page);
    }

    public static async Task LoginAndGoToWorld(IPage page, string username, string worldName = "Aspire Foundations")
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
        var authJson = await page.EvaluateAsync<string>("() => localStorage.getItem('aspire-academy-auth')");
        using var doc = System.Text.Json.JsonDocument.Parse(authJson);
        return doc.RootElement.GetProperty("state").GetProperty("token").GetString()!;
    }

    public static async Task CompleteLearnLessonsViaApi(IPage page, params string[] lessonIds)
    {
        var token = await GetAuthToken(page);
        foreach (var lessonId in lessonIds)
        {
            await page.APIRequest.PostAsync("/api/progress/complete", new()
            {
                Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
                DataObject = new { lessonId },
            });
        }
    }

    public static async Task UnlockFirstChallenge(IPage page)
    {
        await CompleteLearnLessonsViaApi(page, "1.1.1", "1.1.2");

        var token = await GetAuthToken(page);

        // Submit quiz 1.1.3
        await SubmitQuizViaApi(page, token, "1.1.3");
        // Submit boss 1.1-boss
        await SubmitQuizViaApi(page, token, "1.1-boss");

        await CompleteLearnLessonsViaApi(page, "1.2.1", "1.2.2", "1.2.3", "1.2.4");
    }

    private static async Task SubmitQuizViaApi(IPage page, string token, string lessonId)
    {
        var lessonResp = await page.APIRequest.GetAsync($"/api/lessons/{lessonId}", new()
        {
            Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
        });

        if (!lessonResp.Ok)
        {
            return;
        }

        var lesson = await lessonResp.JsonAsync();
        if (!lesson?.TryGetProperty("quiz", out var quiz) == true)
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

        await page.APIRequest.PostAsync($"/api/quizzes/{lessonId}/submit", new()
        {
            Headers = new Dictionary<string, string> { ["Authorization"] = $"Bearer {token}" },
            DataObject = new { answers },
        });
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
