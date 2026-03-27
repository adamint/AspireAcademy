---
name: add-feature
description: "Adds new features to the application including API endpoints, React pages, components, and curriculum content. USE FOR: implementing new features, adding API endpoints, creating React components, adding curriculum content, writing unit/API tests. DO NOT USE FOR: E2E browser tests (use add-e2e-tests skill), adversarial/break testing (use adversarial-tester skill)."
---

# Skill: Add Feature

## When to use
When adding any new feature to the application — API endpoint, React page, component, or curriculum content.

## Process

### 1. Implement the feature

**API changes:**
- Add endpoint in `AspireAcademy.Api/Endpoints/`
- Use constants from `Models/Enums.cs` (no magic strings)
- Use `EndpointHelpers.GetUserId()` for auth
- Return `ErrorResponse` for all errors
- Add structured logging with `ILogger`
- Add OTel metrics/traces where appropriate

**Frontend changes:**
- Add `data-testid` attributes on all interactive elements
- Use constants from `src/constants.ts`
- Use theme tokens (no hardcoded colors)
- Add loading states, error states, empty states
- Add `console.error` on all API failures
- Disable buttons during submission

### 2. Write API tests
Add tests in `AspireAcademy.Api.Tests/` using `WebApplicationFactory`:
- Test happy path (correct input → correct output)
- Test validation errors (bad input → 400)
- Test auth (no token → 401, wrong user → 403)
- Test edge cases (duplicate, not found, already completed)

### 3. Write Playwright E2E tests
Add tests in `AspireAcademy.Api.Tests/E2E/` using C# `Microsoft.Playwright`:
- Test the full user flow through the browser
- Seed prerequisites via `fixture.ApiClient`
- Assert both API response AND visual state
- Test error cases (what does the user see when it fails?)

### 4. Verify
```bash
# Build
dotnet build AspireAcademy.Api/
npx tsc --noEmit  # in AspireAcademy.Web/

# Run API + unit tests
dotnet test AspireAcademy.Api.Tests/ --filter "Category!=E2E"

# Run E2E tests (app must be running)
E2E_WEB_URL=http://localhost:<PORT> dotnet test AspireAcademy.Api.Tests/ --filter "Category=E2E"

# Run React component tests
cd AspireAcademy.Web && npx vitest run
```

ALL tests must pass before the feature is considered done.

## Checklist
- [ ] API endpoint has structured logging
- [ ] API endpoint has error handling (returns ErrorResponse, not 500)
- [ ] API endpoint has at least 1 happy path test
- [ ] API endpoint has at least 1 error case test
- [ ] Frontend has data-testid on interactive elements
- [ ] Frontend has loading state
- [ ] Frontend has error state (user-friendly message)
- [ ] Frontend buttons disabled during submission
- [ ] Playwright E2E test covers the full user flow
- [ ] All existing tests still pass

## Restarting the app

Use `aspire start` NOT `kill` or `kill -9`.

**NEVER mock API responses** (e.g. `playwright-cli route` with `--body`) when testing UI. If the API isn't running, restart it with `aspire start`. All visual checks and tests must hit the real backend.

```bash
# Stop gracefully (preserves data)
aspire stop --all

# Start fresh (rebuilds Docker images if Dockerfile changed)
aspire run
```

**NEVER use `kill -9` on the aspire process** — it can corrupt the PostgreSQL WAL, causing `invalid checkpoint record` errors on next startup. Always use `aspire stop`.

**NEVER delete `aspire-academy-pgdata` volume** — it contains user data. Only delete if schema migration fails and user explicitly asks.
