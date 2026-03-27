# Contributing to Aspire Academy

## Getting Started

### Prerequisites

- [.NET SDK](https://dotnet.microsoft.com/download) (see `global.json` or `.csproj` files for version)
- [Node.js 22+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Aspire CLI](https://learn.microsoft.com/dotnet/aspire/fundamentals/dotnet-aspire-cli): `dotnet tool install -g aspire`

### Clone & Run

```bash
git clone <repo-url>
cd AspireAcademy

# Set the OpenAI connection string (required for AI Tutor; optional for everything else)
aspire secret set ConnectionStrings:openai "Key=sk-your-openai-api-key"

# Start the full stack
aspire run
```

This starts PostgreSQL, Redis, the .NET API, and the React frontend. The Aspire Dashboard opens automatically.

### Install Frontend Dependencies Separately (if needed)

```bash
cd AspireAcademy.Web
npm install
```

## Project Structure

```
AspireAcademy/
├── apphost.cs                          # Aspire AppHost — orchestrates all services
├── aspire.config.json                  # Aspire configuration & profiles
├── AspireAcademy.Api/                  # .NET API (C# Minimal APIs)
│   ├── Program.cs                      # Entry point, middleware, DI
│   ├── Endpoints/                      # Endpoint groups (Auth, Curriculum, Quiz, etc.)
│   ├── Models/                         # EF Core entity models
│   ├── Data/AcademyDbContext.cs        # Database context
│   ├── Services/                       # Business logic (Gamification, AI Tutor, etc.)
│   ├── Curriculum/                     # Content files (loaded at startup)
│   │   ├── worlds.yaml                 # Curriculum structure (source of truth)
│   │   ├── achievements.yaml           # Achievement definitions
│   │   ├── content/                    # Lesson prose (Markdown)
│   │   ├── quizzes/                    # Quiz questions (YAML)
│   │   └── challenges/                 # Code challenges (YAML)
│   └── Migrations/                     # EF Core migrations
├── AspireAcademy.Web/                  # React frontend (Vite + Chakra UI)
│   └── src/
│       ├── pages/                      # Route pages
│       ├── components/                 # Shared components
│       ├── store/                      # Zustand state stores
│       └── api/                        # API client layer
├── AspireAcademy.Api.Tests/            # Backend tests (xUnit)
│   ├── *EndpointsTests.cs              # API endpoint integration tests
│   ├── *ServiceTests.cs                # Service unit tests
│   ├── E2E/                            # Playwright E2E tests (C# harness)
│   └── Fixtures/                       # Test data & shared fixtures
├── AspireAcademy.ServiceDefaults/      # OpenTelemetry, health checks, resilience
└── AspireAcademy.TestAppHost/          # Minimal AppHost for test isolation
```

## Running Tests

### Backend Tests (xUnit)

```bash
# Run all backend tests
dotnet test AspireAcademy.Api.Tests/

# Run a specific test class
dotnet test AspireAcademy.Api.Tests/ --filter "FullyQualifiedName~AuthEndpointsTests"

# Run with verbose output
dotnet test AspireAcademy.Api.Tests/ -v normal
```

Backend tests use `AcademyApiFactory` (a `WebApplicationFactory<Program>`) with an in-memory SQLite database and fake Redis. No Docker required.

### Frontend Unit Tests (Vitest)

```bash
cd AspireAcademy.Web

# Run all tests
npm test

# Run in watch mode
npm test -- --watch

# Run a specific file
npx vitest run src/store/__tests__/authStore.test.ts
```

### Frontend Type Checking

```bash
cd AspireAcademy.Web
npm run type-check
```

### E2E Tests (Playwright)

E2E tests require the full app to be running:

```bash
# Terminal 1: Start the app
aspire run

# Terminal 2: Run E2E tests
cd AspireAcademy.Web
npm run test:e2e
```

### Linting

```bash
cd AspireAcademy.Web
npm run lint
```

## Development Workflow

### Making API Changes

1. Edit endpoint files in `AspireAcademy.Api/Endpoints/`
2. If you change the database model, add a migration:
   ```bash
   cd AspireAcademy.Api
   dotnet ef migrations add YourMigrationName
   ```
3. Run the relevant tests:
   ```bash
   dotnet test AspireAcademy.Api.Tests/ --filter "FullyQualifiedName~YourEndpointTests"
   ```
4. The API hot-reloads during `aspire run` — changes are picked up automatically.

### Making Frontend Changes

1. Edit components in `AspireAcademy.Web/src/`
2. Vite provides instant HMR — changes appear immediately in the browser
3. Run type checking: `npm run type-check`
4. Run tests: `npm test`

### Editing Curriculum Content

Curriculum is loaded from files at app startup. No migrations needed.

- **Lessons**: Add/edit Markdown files in `Curriculum/content/world-N/`
- **Quizzes**: Add/edit YAML files in `Curriculum/quizzes/`
- **Challenges**: Add/edit YAML files in `Curriculum/challenges/`
- **Structure**: Edit `Curriculum/worlds.yaml` to add worlds, modules, or lessons
- **Achievements**: Edit `Curriculum/achievements.yaml`

After editing, click **"Reload Curriculum"** in the Aspire Dashboard (on the API resource), or restart the app.

### Adding a New Endpoint Group

1. Create `AspireAcademy.Api/Endpoints/YourEndpoints.cs`:
   ```csharp
   namespace AspireAcademy.Api.Endpoints;

   public static class YourEndpoints
   {
       public static void MapYourEndpoints(this WebApplication app)
       {
           var group = app.MapGroup("/api/your-feature")
               .RequireAuthorization();
           
           group.MapGet("/", async (AcademyDbContext db) =>
           {
               // ...
           });
       }
   }
   ```

2. Register it in `Program.cs`:
   ```csharp
   app.MapYourEndpoints();
   ```

3. Add test file `AspireAcademy.Api.Tests/YourEndpointsTests.cs`.

## Architecture Decisions

- **Aspire orchestration**: All services (API, frontend, PostgreSQL, Redis) are defined in `apphost.cs` and started together
- **Minimal APIs**: No controllers — all endpoints use `MapGroup` + `MapGet`/`MapPost`
- **SQLite for tests**: `AcademyApiFactory` swaps PostgreSQL for in-memory SQLite so tests run without Docker
- **JWT authentication**: Stateless auth tokens, no session state
- **Curriculum as files**: Markdown + YAML on disk, loaded into the database at startup. Easy to edit, diff, and review
- **Azure deployment**: `aspire deploy` provisions everything via Bicep. See [DEPLOYMENT.md](DEPLOYMENT.md)

## Code Style

- **C#**: Default .NET conventions, `nullable` enabled, `ImplicitUsings` enabled
- **TypeScript**: ESLint config in `eslint.config.js`, strict mode enabled
- **No unnecessary abstractions**: Keep endpoints and services simple and direct
- **Tests are required** for new API endpoints

## Releasing a New Version

Releases are cut manually when you're ready to ship. The `scripts/release.sh` script handles the full flow:

### 1. Update the Changelog

Before releasing, add an entry to `AspireAcademy.Web/src/data/changelog.ts` at the **top** of the array:

```typescript
{
  version: '1.4.0',
  date: '2026-04-01',
  title: '🎯 Your Release Title',
  highlights: ['Feature A', 'Feature B'],
  entries: [
    { type: 'feature', text: 'Description of new feature' },
    { type: 'improvement', text: 'Description of improvement' },
    { type: 'fix', text: 'Description of bug fix' },
  ]
},
```

This powers the **What's New** page in the app. The release script and CI will **fail** if the changelog entry is missing.

### 2. Commit and Release

```bash
git add -A && git commit -m "Prepare release 1.4.0"
./scripts/release.sh 1.4.0
```

The script will:
- Verify the changelog has an entry for this version
- Check for uncommitted changes
- Run backend tests and frontend checks
- Create a git tag `v1.4.0` and push it

Pushing the tag triggers the **Release** GitHub Actions workflow, which runs full CI and creates a GitHub Release with auto-extracted release notes.

### 3. Deploy to Azure

After the release workflow passes:

```bash
aspire deploy
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment details.

## CI/CD

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| **CI** (`.github/workflows/ci.yml`) | Push to `main`, PRs | Backend tests, frontend type-check, lint, build |
| **Release** (`.github/workflows/release.yml`) | `v*` tags | Validates changelog, runs full CI, creates GitHub Release |

## Useful Commands

| Command | Description |
|---------|-------------|
| `aspire run` | Start the full stack locally |
| `aspire run --watch` | Start with file watching (auto-restart on changes) |
| `dotnet test AspireAcademy.Api.Tests/` | Run all backend tests |
| `cd AspireAcademy.Web && npm test` | Run frontend unit tests |
| `cd AspireAcademy.Web && npm run test:e2e` | Run Playwright E2E tests |
| `cd AspireAcademy.Web && npm run type-check` | TypeScript type checking |
| `cd AspireAcademy.Web && npm run lint` | ESLint |
| `./scripts/release.sh <version>` | Tag & push a release (runs checks first) |
| `aspire publish -o ./aspire-output` | Generate deployment artifacts (Bicep) |
| `aspire deploy` | Deploy to Azure |
