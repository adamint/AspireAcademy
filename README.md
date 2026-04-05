# Aspire Academy

**Master Aspire through play.** A gamified learning platform that teaches [Aspire](https://aspire.dev/docs/get-started/aspire-overview) through interactive lessons, code challenges, quizzes, and an AI tutor.

🎮 **[learnaspire.dev](https://learnaspire.dev)**

## What is this?

Aspire Academy is a full-stack web app that walks you from `aspire run` to reading the Aspire source code. Each lesson explains *why* a concept matters before showing the API, and code challenges have you wire real Aspire apps — not toy examples.

- 📖 **158 lessons** across 6 worlds — from app hosting basics to custom resources and deployment
- 🧩 **30 code challenges** with an in-browser editor and automated validation
- 📝 **18 quiz sets** with instant feedback
- 🤖 **AI Tutor** — context-aware hints, code review, and chat powered by GPT-4o
- 🏆 **Gamification** — XP, levels, achievements, streaks, leaderboards, and weekly challenges

## Tech stack

| Layer | Tech |
|-------|------|
| Orchestration | Aspire AppHost |
| Backend | C# Minimal APIs, EF Core, PostgreSQL |
| Frontend | React, Vite, Chakra UI |
| AI | OpenAI / Azure AI Foundry |
| Deployment | Azure Container Apps via `aspire deploy` |

## Quick start

```bash
git clone https://github.com/adamint/AspireAcademy.git
cd AspireAcademy

# Set your AI key (optional — only needed for AI Tutor)
aspire secret set ConnectionStrings:openai "Key=sk-your-key"

# Start everything
aspire run
```

See [SETUP.md](SETUP.md) for detailed configuration and [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow.

## Deployment

Every push to `main` auto-deploys to [learnaspire.dev](https://learnaspire.dev) via GitHub Actions + `aspire deploy`. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full setup.

## License

MIT
