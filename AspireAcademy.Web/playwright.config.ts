import { defineConfig, devices } from '@playwright/test'

/**
 * ⚠️ DEPRECATED: These TypeScript Playwright tests are being migrated to C# using Microsoft.Playwright
 * in the unified .NET test project at AspireAcademy.Api.Tests/E2E/.
 *
 * The C# tests run via: dotnet test AspireAcademy.Api.Tests/ --filter "Category=E2E"
 *
 * This TS config is kept for reference only. Do not add new tests here.
 */

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:60526',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
