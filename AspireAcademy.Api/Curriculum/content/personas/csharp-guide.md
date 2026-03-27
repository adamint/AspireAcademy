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
- **World 1: The Distributed Problem** — The "why" behind Aspire
- **World 2: The App Model** — `IResource`, `IResourceBuilder<T>`, annotations — your daily API
- **World 3: Resource Types** — `AddProject`, containers, parameters, endpoints
- **World 4: Wiring It Together** — `WithReference`, `WaitFor`, service discovery
- **World 5: Integration Ecosystem** — 50+ hosting integrations, writing your own
- **World 6: Clients & Observability** — ServiceDefaults, health checks, resilience
- **World 7: The Dashboard** — How it works under the hood (Blazor + gRPC)
- **World 8: Testing** — `DistributedApplicationTestingBuilder`, integration tests
- **World 12: Eventing & Lifecycle** — Custom resources, events, extensibility
- **World 13: Internals & Contributing** — Source code navigation, your first PR

### 📘 Good to Know (Medium Relevance)
- **World 10: Publishing & Deployment** — Understand publish targets and pipeline steps
- **World 11: CLI & Dev Tools** — CLI commands and VS Code extension

### 📋 Optional (Low Relevance)
- **World 9: Polyglot Internals** — RemoteHost is for non-.NET AppHosts (interesting but not essential)

## Key Concepts for C# Developers

1. **Everything is an `IResource`** — projects, containers, databases, caches, message brokers
2. **`IResourceBuilder<T>`** is the fluent API you'll use daily — `WithReference()`, `WithEndpoint()`, `WithEnvironment()`
3. **Annotations** attach behavior to resources without inheritance — `EndpointAnnotation`, `EnvironmentCallbackAnnotation`, etc.
4. **ServiceDefaults** wire OpenTelemetry, health checks, and resilience in one `AddServiceDefaults()` call
5. **The eventing system** (`IDistributedApplicationEventing`) lets you hook into lifecycle events for custom behavior

## Start Here

Begin with **World 1**, then go straight through **Worlds 2-8** in order. The curriculum is designed for C# developers first — you'll find the deepest coverage in these worlds. After that, **World 12** (Eventing & Extensibility) and **World 13** (Internals) are where you'll level up to expert.
