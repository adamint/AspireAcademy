# Aspire for Polyglot Teams

## Your Role in the Aspire Ecosystem

Your team uses multiple languages — C# APIs alongside TypeScript frontends, Python ML services, Go workers, or Java microservices. Aspire is the orchestration layer that brings them all together into one coherent application model, regardless of language.

## Why Aspire Matters to Your Team

**Before Aspire**, polyglot teams struggled with:
- Each service having its own build/run/deploy workflow
- No shared service discovery — everyone hard-codes URLs
- Configuration drift between languages and environments
- Impossible to run the full stack locally without a 50-line Docker Compose file
- Observability gaps — traces stop at language boundaries

**With Aspire**, one AppHost (in C#, TypeScript, Go, or Python) declares every service. Service discovery works across languages automatically. OpenTelemetry traces flow from your C# API through your Go worker to your Python ML service. Everyone sees the same Dashboard.

## Your Priority Worlds

### 🔥 Must-Do (High Relevance)
- **[World 1: The Distributed Problem](/worlds/world-1)** — The polyglot pain points Aspire solves
- **[World 2: The App Model](/worlds/world-2)** — Resources and the builder pattern (consistent across languages)
- **[World 3: Resource Types](/worlds/world-3)** — .NET projects, containers, JS/Python/Go/Java resources
- **[World 4: Wiring It Together](/worlds/world-4)** — Cross-service references, discovery, and communication
- **[World 5: Integration Ecosystem](/worlds/world-5)** — Shared infrastructure (DB, cache, messaging)
- **[World 6: Observability](/worlds/world-6)** — Cross-language tracing and health checks
- **[World 8: Testing](/worlds/world-8)** — Integration testing polyglot distributed apps
- **[World 9: Polyglot Internals](/worlds/world-9)** — RemoteHost, ATS, code generation — how it all connects
- **[World 10: Publishing & Deployment](/worlds/world-10)** — Deploying the full polyglot stack
- **[World 11: CLI & Dev Tools](/worlds/world-11)** — CLI, VS Code extension for multi-language AppHosts
- **[World 12: Eventing & Lifecycle](/worlds/world-12)** — Custom resources for your team's unique needs

### 📘 Good to Know (Medium Relevance)
- **[World 7: The Dashboard](/worlds/world-7)** — Useful for monitoring but not polyglot-specific
- **[World 13: Internals & Contributing](/worlds/world-13)** — Deep dive if your team wants to extend Aspire

## Key Concepts for Polyglot Teams

1. **One AppHost, many languages** — `AddProject<T>()` for .NET, `AddNpmApp()` for Node, `AddPythonApp()` for Python, `AddContainer()` for anything else
2. **`WithReference()` crosses language boundaries** — A TypeScript frontend can reference a C# API, and Aspire handles the URL injection
3. **Polyglot AppHosts** — Your team can write the AppHost itself in TypeScript, Go, Python, or Java via RemoteHost
4. **ATS (Application Type System)** generates type-safe bindings for each language from the Aspire resource model
5. **OpenTelemetry is language-agnostic** — Traces, metrics, and logs flow through the Dashboard from all services
6. **Code generation pipeline** turns the Aspire model into TypeScript stubs, Go structs, Python dataclasses, etc.

## Start Here

Start with **[World 1](/worlds/world-1)** (everyone needs foundations), then go through **[World 3](/worlds/world-3)** paying special attention to Module 3.3 (polyglot resources). **[World 9](/worlds/world-9)** is your team's most important world — it explains how non-.NET AppHosts communicate with Aspire infrastructure. After that, follow the linear path through Worlds 4-6 for cross-service wiring and observability.
