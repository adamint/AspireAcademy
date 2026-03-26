# E2E Testing Skill — Aspire Academy

## Purpose

Every user-facing scenario in the app MUST have an end-to-end test that:
1. Starts the real app using `DistributedApplicationTestingBuilder`
2. Seeds any required data (users, progress, curriculum) via the C# `HttpClient`
3. Tests API responses directly via `HttpClient` (verify status codes, response shapes, business logic)
4. Uses **C# Playwright** (`Microsoft.Playwright`) to interact with the UI exactly as a real user would
5. Asserts at every step that no errors occur (no 500s, no 404s, no blank pages, no "Something went wrong")

All of this happens in a SINGLE xUnit test project — not separate test runners.

## Architecture

```
AspireAcademy.Api.Tests/
├── Fixtures/
│   └── AppHostFixture.cs          # IAsyncLifetime: starts AppHost, installs Playwright
├── ApiTests/
│   ├── AuthApiTests.cs            # Direct HTTP tests against API
│   ├── CurriculumApiTests.cs
│   ├── QuizApiTests.cs
│   └── ...
├── E2ETests/
│   ├── UserJourneyTests.cs        # Playwright browser tests
│   ├── QuizE2ETests.cs
│   └── ...
└── CurriculumValidationTests.cs   # YAML schema tests (no app needed)
```

### Why C# Playwright (not TypeScript Playwright)

The TypeScript `e2e/*.spec.ts` approach is WRONG because:
- It runs in a separate process, can't share the AppHost lifecycle
- It assumes hardcoded ports that change every run
- It can't seed data programmatically — has to use raw HTTP
- API tests and UI tests run independently, missing integration issues

The C# approach (`Microsoft.Playwright` NuGet package) is correct because:
- Same test project as API tests → shared `AppHostFixture`
- Playwright browser connects to the REAL web URL from `app.GetEndpoint("web")`
- Seed data via `app.CreateHttpClient("api")` in the same test
- One test can verify BOTH the API response AND the browser UI
- AppHost starts once, all tests share it via `IClassFixture<AppHostFixture>`

## Testing Methodology

### Layer 1: App Orchestration (Aspire.Hosting.Testing)

A shared fixture starts the real AppHost ONCE for all tests:

```csharp
public class AppHostFixture : IAsyncLifetime
{
    public DistributedApplication App { get; private set; } = null!;
    public HttpClient ApiClient { get; private set; } = null!;
    public Uri WebUrl { get; private set; } = null!;
    public IPage Browser { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        // 1. Start real AppHost (Postgres + Redis + CodeRunner + API + Web)
        var builder = await DistributedApplicationTestingBuilder
            .CreateAsync<Projects.AspireAcademy_TestAppHost>();
        App = await builder.BuildAsync();
        await App.StartAsync();

        // 2. Get real clients
        ApiClient = App.CreateHttpClient("api");
        ApiClient.DefaultRequestHeaders.Add("X-Test-Client", "true");
        WebUrl = App.GetEndpoint("web");

        // 3. Wait for healthy
        await WaitForHealthy();

        // 4. Install and launch Playwright browser
        Microsoft.Playwright.Program.Main(["install", "chromium"]);
        var playwright = await Playwright.CreateAsync();
        var browser = await playwright.Chromium.LaunchAsync();
        Browser = await browser.NewPageAsync();
    }

    public async Task DisposeAsync()
    {
        await App.StopAsync();
        await App.DisposeAsync();
    }
}
```

### Layer 2: API Tests (HttpClient)

Test every API endpoint directly — verify status codes, response shapes, business logic:

```csharp
[Collection("AppHost")]
public class AuthApiTests(AppHostFixture fixture)
{
    [Fact]
    public async Task Register_ReturnsToken()
    {
        var response = await fixture.ApiClient.PostAsJsonAsync("/api/auth/register", new {
            username = $"test_{Guid.NewGuid():N}",
            email = $"test_{Guid.NewGuid():N}@test.com",
            password = "Password1!",
            displayName = "Test"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.TryGetProperty("token", out _));
    }
}
```

### Layer 3: Browser E2E Tests (C# Playwright)

Test the UI by navigating the REAL browser to the REAL web URL:

```csharp
[Collection("AppHost")]
public class UserJourneyTests(AppHostFixture fixture)
{
    [Fact]
    public async Task FullUserJourney()
    {
        var page = fixture.Browser;
        var baseUrl = fixture.WebUrl.ToString().TrimEnd('/');

        // 1. Go to app → see login page
        await page.GotoAsync(baseUrl);
        await Expect(page).ToHaveURLAsync(new Regex("login"));

        // 2. Register
        await page.FillAsync("[name='username']", $"user_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}");
        await page.FillAsync("[name='email']", $"e2e_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}@test.com");
        await page.FillAsync("[name='password']", "Password1!");
        await page.FillAsync("[name='confirmPassword']", "Password1!");
        await page.ClickAsync("button[type='submit']");

        // 3. Dashboard loads (NOT blank, NOT error)
        await Expect(page).ToHaveURLAsync(new Regex("dashboard"));
        await Expect(page.GetByText("Welcome")).ToBeVisibleAsync();

        // 4. World cards visible
        await Expect(page.Locator("[data-testid='world-card']").First).ToBeVisibleAsync();

        // 5. Click first world → modules load
        await page.Locator("[data-testid='world-card']").First.ClickAsync();
        await Expect(page.GetByText("Module")).ToBeVisibleAsync();

        // ... continue through entire flow
    }
}
```

### Layer 4: Data Seeding (via API)

## Required Test Scenarios

Every scenario below MUST have a Playwright test that runs against the real app:

### Authentication
- [ ] Register → see dashboard
- [ ] Register with invalid data → see validation errors (not 500)
- [ ] Login → see dashboard
- [ ] Login with wrong password → see error message (not 500)
- [ ] Logout → redirect to login
- [ ] Refresh page → stay authenticated

### Curriculum Browsing
- [ ] Dashboard shows world cards with progress
- [ ] Click world → see modules with lessons
- [ ] Locked lessons show lock icon
- [ ] Unlocked lessons are clickable

### Learn Lessons
- [ ] Open lesson → see markdown content (not blank)
- [ ] Code blocks are syntax highlighted
- [ ] Mark Complete → button disabled, XP increases
- [ ] Already completed → button shows "Completed"
- [ ] Previous/Next navigation works
- [ ] Back button returns to module page

### Quizzes
- [ ] Open quiz → see question with options
- [ ] Select answer → submit → see feedback (correct/wrong)
- [ ] Feedback shows explanation
- [ ] Complete all questions → see score summary
- [ ] Code in questions renders properly (not raw markdown)
- [ ] Wrong answer shows as wrong (not always "correct")
- [ ] Right answer shows as right (not always "wrong")

### Code Challenges
- [ ] Editor loads with starter code
- [ ] Instructions panel visible
- [ ] Run → output panel shows result
- [ ] Submit → test cases show ✅/❌
- [ ] Hints reveal progressively

### Profile & Social
- [ ] Own profile loads with stats
- [ ] Leaderboard shows entries
- [ ] Achievements page renders
- [ ] Friend search works
- [ ] Theme toggle works

### Error Handling
- [ ] Invalid URL → 404 page (not blank)
- [ ] API error → user-friendly message (not stack trace)
- [ ] No double-click issues on any button

## Anti-Patterns (DO NOT DO)

- ❌ Do NOT test against SQLite in-memory — use real Postgres
- ❌ Do NOT mock the CodeRunner — use the real Docker container
- ❌ Do NOT use fake Redis — use the real Redis container
- ❌ Do NOT test only happy paths — test error scenarios too
- ❌ Do NOT test with hardcoded data — use real curriculum from YAML
- ❌ Do NOT skip tests because "modules are locked" — seed progress to unlock them
- ❌ Do NOT assume API response shapes — verify actual JSON structure
- ❌ Do NOT weaken tests to make them pass — fix the app code instead

## When to Use This Skill

- When adding any new feature (API endpoint, React page, component)
- When fixing any bug (add a test that would have caught it)
- When a user reports an issue (reproduce with a test first, then fix)
- When doing a code review (check if the change has test coverage)
- Before any release (run full test suite against real app)
