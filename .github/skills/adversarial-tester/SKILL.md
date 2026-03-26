# Skill: Adversarial Tester

## When to use
After any feature is added or bug is fixed, run this adversarial testing process to find what's still broken. Think like a user who clicks everything, enters garbage, refreshes at wrong times, and tries to break things.

## Process

### 1. Start the app
Ensure `aspire run` is running with all resources healthy. **Do NOT delete the postgres data volume.**

### 2. Register a fresh user via Playwright
```csharp
var page = await fixture.NewPageAsync();
await E2EHelpers.RegisterUser(page, $"adversary_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}");
```

### 3. Try to break every page

For EACH page, do these adversarial tests:

**General (every page):**
- Refresh the page → should not lose state or crash
- Navigate away and back → should still work
- Open in new tab → should work (auth from localStorage)
- Resize to mobile width → should not break layout

**Forms:**
- Submit empty → should show validation (not 500)
- Submit with XSS payload (`<script>alert(1)</script>`) → should be escaped
- Submit with SQL injection (`'; DROP TABLE users;--`) → should be rejected
- Double-click submit → should not submit twice
- Submit then immediately navigate away → should not crash

**Buttons:**
- Click while loading → should be disabled
- Click rapidly 10 times → should only trigger once
- Right-click → should not break anything

**Navigation:**
- Type invalid URL directly → should show 404
- Navigate to locked content → should show locked state or redirect
- Use browser back/forward → should work correctly
- Click sidebar items rapidly → should not crash

**Data:**
- Complete same lesson twice → should not double-award XP
- Submit quiz without answering → should show validation
- Submit challenge with empty code → should show error
- Answer quiz correctly → must show "Correct!" (not "Incorrect")
- Answer quiz wrong → must show "Incorrect" (not "Correct!")

### 4. Write Playwright tests for EVERY adversarial scenario

```csharp
[Trait("Category", "E2E")]
[Collection("E2E")]
public class AdversarialTests(AppHostPlaywrightFixture fixture)
{
    [Fact]
    public async Task DoubleClickMarkComplete_NoError()
    {
        var page = await fixture.NewPageAsync();
        await E2EHelpers.RegisterUser(page, $"adv_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}");
        // Navigate to lesson, click mark complete twice rapidly
        var btn = page.GetByTestId("mark-complete-btn");
        await btn.ClickAsync();
        await btn.ClickAsync(); // should not error
        await Assertions.Expect(btn).ToBeDisabledAsync(new() { Timeout = 5_000 });
    }

    [Fact]
    public async Task XSSInUsername_Escaped()
    {
        var page = await fixture.NewPageAsync();
        await page.GotoAsync(fixture.WebBaseUrl + "/register");
        await page.FillAsync("[name='username']", "<script>alert(1)</script>");
        // ... verify no script execution
    }
}
```

### 5. For every failure: fix the app, then add the test

If an adversarial test reveals a bug:
1. Fix the bug in the application code
2. Keep the test (it prevents regression)
3. The test should PASS after the fix

### 6. Report findings

After each adversarial session, document:
- Total scenarios tested
- Bugs found (with severity)
- Bugs fixed
- Tests added
- Remaining known issues

## Key adversarial scenarios to always check
- [ ] Correct quiz answer shows "Correct!" (not "Incorrect")
- [ ] Wrong quiz answer shows "Incorrect" (not "Correct!")
- [ ] Mark Complete twice → no error
- [ ] Submit empty form → validation (not 500)
- [ ] XSS in any text field → escaped
- [ ] Locked content → can't submit (403 handled gracefully)
- [ ] Expired JWT → redirected to login (not 500)
- [ ] Code challenge Run → actual compilation result (not workload error)
- [ ] Refresh any page → state preserved
- [ ] All buttons disabled during API calls
