# Aspire for DevOps Engineers

## Your Role in the Aspire Ecosystem

As a DevOps engineer, you're the person who keeps distributed systems running in production. You care about **deployment pipelines**, **container orchestration**, **monitoring dashboards**, and **infrastructure-as-code**. Aspire was built with you in mind — it bridges the gap between what developers build locally and what you deploy to production.

## Why Aspire Matters to You

**Before Aspire**, deploying a distributed app meant:
- Manually writing Docker Compose files, Kubernetes manifests, or Bicep templates
- Reverse-engineering which services connect to what
- Hoping the developer's local setup matches production
- Maintaining separate config for dev, staging, and prod

**With Aspire**, the AppHost IS the deployment manifest. The same code that runs locally can publish to Docker Compose, Kubernetes, or Azure — with service discovery, health checks, and observability baked in.

## Your Priority Worlds

### 🔥 Must-Do (High Relevance)
- **[World 1: The Distributed Problem](/worlds/world-1)** — Understand what Aspire replaces in your workflow
- **[World 3: Resource Types](/worlds/world-3)** — Containers, volumes, persistent lifetimes, parameters
- **[World 5: Integration Ecosystem](/worlds/world-5)** — Database hosting, cache, messaging, Azure provisioning
- **[World 6: Clients & Observability](/worlds/world-6)** — OpenTelemetry, health checks, metrics — your bread and butter
- **[World 7: The Dashboard](/worlds/world-7)** — Real-time resource monitoring and diagnostics
- **[World 10: Publishing & Deployment](/worlds/world-10)** — Docker Compose, Kubernetes, Azure Bicep publishing
- **[World 11: CLI & Dev Tools](/worlds/world-11)** — CLI commands, MCP server, automation

### 📘 Good to Know (Medium Relevance)
- **[World 2: The App Model](/worlds/world-2)** — Understand how developers define resources
- **[World 4: Wiring It Together](/worlds/world-4)** — Service discovery and dependency ordering
- **[World 8: Testing](/worlds/world-8)** — Integration testing patterns for CI/CD pipelines
- **[World 12: Eventing & Lifecycle](/worlds/world-12)** — Custom events and lifecycle hooks

### 📋 Optional (Low Relevance)
- **[World 9: Polyglot Internals](/worlds/world-9)** — RemoteHost and ATS are developer concerns
- **[World 13: Internals & Contributing](/worlds/world-13)** — Unless you want to contribute to Aspire itself

## Key Concepts for DevOps

1. **`aspire publish`** generates deployment artifacts from the same AppHost code developers use locally
2. **Pipeline steps** let you customize the publish process (image building, manifest generation, deployment)
3. **Health checks** are automatically wired for all resources — your monitoring stack just works
4. **The Dashboard** gives you resource state, logs, traces, and metrics in one place
5. **The CLI** (`aspire run`, `aspire ps`, `aspire logs`) integrates into your automation scripts

## Start Here

Begin with **[World 1](/worlds/world-1)** to understand the problem space, then jump to **[World 10](/worlds/world-10)** (Publishing & Deployment) once you've completed the foundations. That's where Aspire's value is most tangible for your role.
