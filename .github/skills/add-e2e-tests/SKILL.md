# Skill: Add E2E Tests

## When to use
When adding, fixing, or verifying test coverage for any part of the application.

## Process

### 1. Start the real app
The app MUST be running via `aspire run` with real Postgres, Redis, and CodeRunner. NEVER test against mocks or in-memory databases.

**NEVER delete the postgres data volume** (`aspire-academy-pgdata`) — it contains user data. Only delete if schema changed and migrations fail.

### 2. Write C# Playwright tests
All E2E tests go in `AspireAcademy.Api.Tests/E2E/` using `Microsoft.Playwright` NuGet package. NOT TypeScript specs.

```csharp
[Trait("Category", "E2E")]
[Collection("E2E")]
public class MyTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task MyTest()
    {
        var page = await fixture.NewPageAsync();
        await page.GotoAsync(fixture.WebBaseUrl + "/login");
        // ... interact with the real UI
    }
}
```

### 3. Test requirements
Every test MUST:
- Run against the REAL app (not mocks)
- Seed data via `fixture.ApiClient` if needed (register user, complete lessons)
- Use `data-testid` selectors where available
- Assert at EVERY step (not just final state)
- Verify API responses (status codes, response body) AND browser state
- Use 15s timeouts for elements that depend on API calls

### 4. What to test for each scenario
For each user flow, test:
- Happy path works
- Error cases show user-friendly messages (not 500s, not stack traces)
- Buttons are disabled during submission (no double-click)
- State persists correctly (refresh doesn't lose progress)
- Locked content is not accessible

### 5. Run tests
```bash
E2E_WEB_URL=http://localhost:<PORT> dotnet test AspireAcademy.Api.Tests/ --filter "Category=E2E"
```

### 6. Fix app bugs, not tests
If a test fails, fix the APPLICATION CODE. Never weaken assertions to make tests pass.

## Anti-patterns
- ❌ Testing against SQLite/mocks instead of real Postgres
- ❌ Using TypeScript Playwright specs (use C# Microsoft.Playwright)
- ❌ Checking only that "element is visible" without verifying content
- ❌ Skipping tests because prerequisites are locked (seed progress first)
- ❌ Deleting the database volume on restart
