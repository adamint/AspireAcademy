# E2E Testing Skill — Aspire Academy

## Purpose

Every user-facing scenario in the app MUST have an end-to-end test that:
1. Starts the real app using `DistributedApplicationTestingBuilder`
2. Seeds any required data (users, progress, curriculum)
3. Uses Playwright to interact with the UI exactly as a real user would
4. Asserts at every step that no errors occur (no 500s, no 404s, no blank pages, no "Something went wrong")

## Testing Methodology

### Layer 1: App Orchestration (Aspire.Hosting.Testing)

Every test suite MUST start the real AppHost with real services:

```csharp
// In a shared fixture (IAsyncLifetime)
var builder = await DistributedApplicationTestingBuilder.CreateAsync<Projects.AspireAcademy_TestAppHost>();
await using var app = await builder.BuildAsync();
await app.StartAsync();

// Get real HTTP clients
var apiClient = app.CreateHttpClient("api");
var webUrl = app.GetEndpoint("web");

// Wait for healthy
await apiClient.GetAsync("/health"); // must return 200
```

This ensures:
- Real PostgreSQL (not SQLite in-memory)
- Real Redis (not fake mocks)
- Real CodeRunner (not stubbed HTTP handler)
- Real curriculum loaded from YAML files
- Real CORS, rate limiting, JWT validation

### Layer 2: Data Seeding

Before each test scenario, seed the required state via the API:

```csharp
// Register a user
var registerResponse = await apiClient.PostAsJsonAsync("/api/auth/register", new {
    username = $"test_{Guid.NewGuid():N}",
    email = $"test_{Guid.NewGuid():N}@test.com",
    password = "Password1!",
    displayName = "Test User"
});
var token = (await registerResponse.Content.ReadFromJsonAsync<JsonElement>())
    .GetProperty("token").GetString();

// Complete prerequisites to unlock a quiz
await apiClient.PostAsJsonAsync("/api/progress/complete",
    new { lessonId = "1.1.1" },
    headers: new { Authorization = $"Bearer {token}" });

// Seed admin + test data
await apiClient.PostAsync("/api/admin/seed-test-data",
    null,
    headers: new { ["X-Aspire-Admin"] = "aspire-internal" });
```

### Layer 3: Playwright Browser Tests

After the app is running and data is seeded, use Playwright to simulate real user actions:

```typescript
test('complete user journey', async ({ page }) => {
    // 1. Navigate to app
    await page.goto('/');
    await expect(page).toHaveURL(/login/);

    // 2. Register
    await page.fill('[name="username"]', `user_${Date.now()}`);
    await page.fill('[name="email"]', `user_${Date.now()}@test.com`);
    await page.fill('[name="password"]', 'Password1!');
    await page.fill('[name="confirmPassword"]', 'Password1!');
    await page.click('button[type="submit"]');

    // 3. Verify dashboard loaded (NOT blank, NOT error)
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText('Welcome')).toBeVisible();

    // 4. Verify API call succeeded (intercept network)
    const worldsResponse = await page.waitForResponse(
        resp => resp.url().includes('/api/worlds') && resp.status() === 200
    );

    // 5. Click through UI elements
    await page.click('[data-testid="world-card-world-1"]');
    await expect(page.getByText('Module')).toBeVisible();

    // ... continue through entire flow
});
```

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
