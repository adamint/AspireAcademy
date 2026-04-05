# Aspire Learn — Setup Guide

## Prerequisites

- [.NET 11 SDK](https://dotnet.microsoft.com/download/dotnet/11.0) or later
- [Node.js 22+](https://nodejs.org/) (for the React frontend)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL)
- [Aspire CLI](https://aspire.dev/docs/get-started/setup-tooling) — install via `curl -sSL https://aspire.dev/install.sh | bash` (macOS/Linux) or `irm https://aspire.dev/install.ps1 | iex` (Windows)

## Required Configuration

### 1. AI Provider — OpenAI or Azure AI Foundry (Required for AI Tutor)

The AI tutor needs an API key for chat completions. Supports **OpenAI**, **Azure OpenAI**, or **Azure AI Foundry**:

```bash
# Option A: OpenAI directly
aspire secret set ConnectionStrings:openai "Key=sk-your-openai-api-key-here"

# Option B: Azure OpenAI / Azure AI Foundry
aspire secret set ConnectionStrings:openai "Endpoint=https://your-resource.openai.azure.com;Key=your-key-here"

# Option C: Any OpenAI-compatible endpoint (Foundry, Ollama, etc.)
aspire secret set ConnectionStrings:openai "Endpoint=https://your-endpoint.example.com/v1;Key=your-key"
```

The AI tutor uses `gpt-4o` by default. The connection string format is `Key=...` (direct OpenAI) or `Endpoint=...;Key=...` (custom endpoint).

**Without this:** The app starts but AI Tutor (chat, hints, code review) won't work. All other features are unaffected.

### 2. JWT Secret Key (Auto-configured)

The AppHost generates a random JWT signing key each dev session automatically. No manual configuration needed.

For deployment, `aspire deploy` prompts for a persistent key that gets stored as an ACA secret.

### 3. PostgreSQL (Auto-configured)

Managed by Aspire — no manual configuration needed. The AppHost starts the container automatically:
- **PostgreSQL** — data persisted in Docker volume `aspire-learn-pgdata`

## Running the App

```bash
cd ~/source/repos/AspireAcademy

# Set the OpenAI key first (see above), then:
aspire run
```

The Dashboard will open showing all resources. The web frontend URL will be shown in the Dashboard's Resources view.

## Running Tests

```bash
# API integration tests
dotnet test AspireAcademy.Api.Tests/

# React component tests
cd AspireAcademy.Web && npm test

# TypeScript type checking
cd AspireAcademy.Web && npm run type-check

# Playwright E2E (requires running app)
cd AspireAcademy.Web && npm run test:e2e
```

## Project Structure

```
AspireAcademy/
├── apphost.cs                          # Aspire AppHost — orchestrates everything
├── aspire.config.json                  # Aspire configuration
├── AspireAcademy.Api/                  # Backend API (.NET)
│   ├── Endpoints/                      # Minimal API endpoint groups
│   ├── Models/                         # EF Core entity models
│   ├── Data/                           # DbContext + migrations
│   ├── Services/                       # Business logic
│   └── Curriculum/                     # Content files (markdown + YAML)
│       ├── worlds.yaml                 # Curriculum structure (source of truth)
│       ├── achievements.yaml           # Achievement definitions
│       ├── content/world-{1-6}/        # Lesson prose (158 markdown files)
│       ├── quizzes/                    # Quiz questions (18 YAML files)
│       └── challenges/                 # Code challenges (30 YAML files)
├── AspireAcademy.ServiceDefaults/      # OpenTelemetry, health checks, resilience
├── AspireAcademy.Api.Tests/            # API integration tests
└── AspireAcademy.Web/                  # React frontend (Chakra UI)
```

## Editing Curriculum Content

Content lives as files on disk — no database migrations needed:

- **Add a lesson:** Create a `.md` file in `Curriculum/content/world-N/`, add entry to `worlds.yaml`
- **Add quiz questions:** Create/edit `.yaml` file in `Curriculum/quizzes/`
- **Add a code challenge:** Create/edit `.yaml` file in `Curriculum/challenges/`
- Content is loaded from files into the database at app startup

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "OpenAI connection string not configured" | Set the `ConnectionStrings:openai` secret (see above) |
| Database migration errors | Delete the `aspire-academy-pgdata` Docker volume and restart |
| CodeRunner timeout | User code has a 30s execution limit; check for infinite loops |
| Port conflicts | Aspire uses random ports; check Dashboard for actual URLs |
| React dev server won't start | Run `cd AspireAcademy.Web && npm install` |
