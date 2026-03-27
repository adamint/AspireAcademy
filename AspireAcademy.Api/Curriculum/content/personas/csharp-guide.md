# Aspire for C# Developers

## Your Role in the Aspire Ecosystem

As a C# developer, Aspire is your home turf. The entire hosting API is C# — `DistributedApplicationBuilder`, `IResourceBuilder<T>`, annotations, eventing, and the extension model. You'll learn to build, extend, and even contribute to Aspire itself.

## Why Aspire Matters to You

**Before Aspire**, building distributed .NET apps meant:
- Juggling multiple `launchSettings.json` profiles
- Manually managing connection strings across projects
- Writing custom health check orchestration
- No standard way to add Redis, Postgres, or RabbitMQ to your local dev loop

**With Aspire**, you write one AppHost that declares your entire distributed system. `AddProject<T>()`, `AddPostgres()`, `WithReference()` — it's all fluent C# with full IntelliSense.

## Your Priority Worlds

### 🔥 Must-Do (High Relevance)
- **[World 1: The Distributed Problem](/worlds/world-1)** — The "why" behind Aspire
- **[World 2: The App Model](/worlds/world-2)** — `IResource`, `IResourceBuilder<T>`, annotations — your daily API
- **[World 3: Resource Types](/worlds/world-3)** — `AddProject`, containers, parameters, endpoints
- **[World 4: Wiring It Together](/worlds/world-4)** — `WithReference`, `WaitFor`, service discovery
- **[World 5: Integration Ecosystem](/worlds/world-5)** — 50+ hosting integrations, writing your own
- **[World 6: Clients & Observability](/worlds/world-6)** — ServiceDefaults, health checks, resilience
- **[World 7: The Dashboard](/worlds/world-7)** — How it works under the hood (Blazor + gRPC)
- **[World 8: Testing](/worlds/world-8)** — `DistributedApplicationTestingBuilder`, integration tests
- **[World 12: Eventing & Lifecycle](/worlds/world-12)** — Custom resources, events, extensibility
- **[World 13: Internals & Contributing](/worlds/world-13)** — Source code navigation, your first PR

### 📘 Good to Know (Medium Relevance)
- **[World 10: Publishing & Deployment](/worlds/world-10)** — Understand publish targets and pipeline steps
- **[World 11: CLI & Dev Tools](/worlds/world-11)** — CLI commands and VS Code extension

### 📋 Optional (Low Relevance)
- **[World 9: Polyglot Internals](/worlds/world-9)** — RemoteHost is for non-.NET AppHosts (interesting but not essential)

## Key Concepts for C# Developers

1. **Everything is an `IResource`** — projects, containers, databases, caches, message brokers
2. **`IResourceBuilder<T>`** is the fluent API you'll use daily — `WithReference()`, `WithEndpoint()`, `WithEnvironment()`
3. **Annotations** attach behavior to resources without inheritance — `EndpointAnnotation`, `EnvironmentCallbackAnnotation`, etc.
4. **ServiceDefaults** wire OpenTelemetry, health checks, and resilience in one `AddServiceDefaults()` call
5. **The eventing system** (`IDistributedApplicationEventing`) lets you hook into lifecycle events for custom behavior

## Start Here

Begin with **[World 1](/worlds/world-1)**, then go straight through **Worlds 2-8** in order. The curriculum is designed for C# developers first — you'll find the deepest coverage in these worlds. After that, **[World 12](/worlds/world-12)** (Eventing & Extensibility) and **[World 13](/worlds/world-13)** (Internals) are where you'll level up to expert.
