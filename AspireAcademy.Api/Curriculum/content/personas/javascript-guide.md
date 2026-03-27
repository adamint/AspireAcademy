# Aspire for JavaScript/TypeScript Developers

## Your Role in the Aspire Ecosystem

As a JS/TS developer, you can use Aspire to orchestrate your Node.js APIs, Vite frontends, and full-stack apps alongside .NET services, databases, and caches — all from a single AppHost. Even better, you can write your AppHost in TypeScript using Aspire's polyglot support.

## Why Aspire Matters to You

**Before Aspire**, building full-stack JS apps with backend services meant:
- Running `docker compose up` for databases and caches
- Managing `.env` files across multiple services
- No standard service discovery between frontend and backend
- Separate tooling for each piece of infrastructure

**With Aspire**, your Vite dev server, Node.js API, PostgreSQL, and Redis are all declared in one place. Service URLs are automatically injected as environment variables. The Dashboard shows logs and traces from every service — including your Node app.

## Your Priority Worlds

### 🔥 Must-Do (High Relevance)
- **World 1: The Distributed Problem** — Why Aspire exists and how to get started
- **World 3, Module 3.3: JavaScript & Node Resources** — `AddNpmApp`, `AddViteApp`, package manager detection
- **World 4, Module 4.1: WithReference & Service Discovery** — How your frontend discovers backend URLs
- **World 9: Polyglot Internals** — RemoteHost, TypeScript AppHosts, JSON-RPC, code generation
- **World 11: CLI & Dev Tools** — CLI, VS Code extension, MCP server, TypeScript AppHost parsing

### 📘 Good to Know (Medium Relevance)
- **World 2: The App Model** — Understanding resources and the builder pattern
- **World 3: Other Resources** — Containers, parameters, endpoints (you'll use these)
- **World 5: Integration Ecosystem** — Databases and caches your apps connect to
- **World 6: Observability** — OpenTelemetry works with Node.js too
- **World 10: Publishing** — How your Vite app gets deployed alongside everything else

### 📋 Optional (Low Relevance)
- **World 8: Testing** — .NET-specific integration testing patterns
- **World 12: Eventing & Lifecycle** — C# extensibility internals
- **World 13: Internals & Contributing** — .NET source code deep dive

## Key Concepts for JS/TS Developers

1. **`AddNpmApp("name", "../path")`** adds a Node.js service to your Aspire app
2. **`AddViteApp("frontend", "../path")`** adds a Vite dev server with HMR
3. **`WithReference(api)`** injects the API's URL as `services__api__https__0` environment variable
4. **TypeScript AppHost** — You can write your entire AppHost in TypeScript using `@aspire/apphost`
5. **Package manager detection** — Aspire auto-detects npm, yarn, or pnpm and uses the right commands

## Start Here

Start with **World 1** for the big picture. Then prioritize **World 3, Module 3.3** (JavaScript resources) to learn how your services fit in. After that, **World 9** (Polyglot Internals) is where you'll learn to write AppHosts in TypeScript — a game changer for JS-first teams.
