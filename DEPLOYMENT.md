# Aspire Academy — Deployment Guide

This project uses **Aspire's built-in publish/deploy pipeline** to deploy to Azure. Deployments are automated via GitHub Actions:
- **Every push to `main`** runs tests and auto-deploys to production.
- **Pushing a version tag** (`v*`) additionally creates a GitHub Release with changelog notes.

## What Gets Deployed

| Resource | Azure Service | Notes |
|----------|--------------|-------|
| API + React SPA | **Azure Container Apps** | React build is bundled into the API container as static files |
| PostgreSQL | **Azure Database for PostgreSQL Flexible Server** | Burstable B1ms, 32 GB, Entra ID auth (no passwords) |
| Identity | **User-Assigned Managed Identity** | RBAC roles for PostgreSQL |
| Container Registry | **Azure Container Registry** | Auto-created for container images |
| Networking | **Container Apps Environment** | Shared environment with Log Analytics |

The React SPA is **not** deployed as a separate service. At publish time, Aspire runs `npm run build` and copies the output into the API container's `wwwroot/` folder. The API serves the SPA as static files in production.

## One-Time Setup

Before the automated pipeline can deploy, you need to configure Azure OIDC credentials and GitHub secrets. This is a one-time setup.

### Prerequisites

1. **Azure CLI** — [Install](https://learn.microsoft.com/cli/azure/install-azure-cli)
2. **Azure subscription** with permissions to create resource groups and app registrations
3. **GitHub repo admin access** — to configure environments and secrets

### Step 1: Create a Resource Group

```bash
az login
az group create --name aspire-academy --location eastus
```

### Step 2: Create an Entra ID App Registration

```bash
az ad app create --display-name "AspireAcademy-Deploy"
APP_ID=$(az ad app list --display-name "AspireAcademy-Deploy" --query "[0].appId" -o tsv)

# Create a service principal
az ad sp create --id "$APP_ID"
```

### Step 3: Add OIDC Federated Credential

This lets GitHub Actions authenticate to Azure without stored passwords:

```bash
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:adamint/AspireAcademy:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

### Step 4: Grant Permissions

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SP_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv)

# Contributor on the resource group (creates/updates resources)
az role assignment create --assignee "$SP_ID" \
  --role Contributor \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/aspire-academy"

# User Access Administrator (for managed identity role assignments)
az role assignment create --assignee "$SP_ID" \
  --role "User Access Administrator" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/aspire-academy"
```

### Step 5: Prepare Secrets

You'll need two values for the first deploy:

| Secret | Description |
|--------|-------------|
| **JWT signing key** | A random string, at least 32 characters. Used to sign auth tokens. |
| **AI connection string** | `Endpoint=https://your-resource.services.ai.azure.com/;Key=your-key` (Azure AI Foundry) or `Key=sk-your-key` (OpenAI) |

Generate a JWT key:

```bash
openssl rand -base64 48
```

### Step 6: Configure GitHub

1. Go to your repo's **Settings → Environments** and create an environment named `production`
2. Go to **Settings → Secrets and variables → Actions** and add:

| Type | Name | Value |
|------|------|-------|
| Secret | `AZURE_CLIENT_ID` | The app registration's Application (client) ID |
| Secret | `AZURE_TENANT_ID` | Your Entra ID tenant ID |
| Secret | `AZURE_SUBSCRIPTION_ID` | Target Azure subscription ID |
| Variable | `AZURE_RESOURCE_GROUP` | Resource group name (e.g., `aspire-academy`) |
| Variable | `AZURE_LOCATION` | Azure region (e.g., `eastus`) |

### Step 7: First Deploy (Interactive)

The first deploy must be run **manually** to provide the JWT key and OpenAI connection string (these get stored as ACA secrets and persist for future deploys):

```bash
aspire deploy
```

The Aspire CLI will interactively prompt you for:

1. **Azure tenant** — Select your Entra ID tenant
2. **Azure subscription** — Select the subscription to deploy to
3. **Resource group** — Enter the name from Step 1
4. **Location** — Azure region
5. **jwt-key** — Paste your JWT signing key
6. **openai connection string** — Paste your AI connection string (Azure AI Foundry endpoint or OpenAI API key)

After this first deploy, all subsequent deploys (automated or manual) reuse these stored secrets.

## Releasing & Deploying

### Automated (Recommended)

After the one-time setup, every release is a single command:

```bash
./scripts/release.sh 1.5.0
```

This script:
1. Validates changelog entry exists in `AspireAcademy.Web/src/data/changelog.ts`
2. Checks for uncommitted changes
3. Runs backend tests and frontend checks locally
4. Creates git tag `v1.5.0` and pushes it

Pushing the tag triggers the **Release & Deploy** GitHub Actions workflow, which:
1. **Validates** — confirms changelog entry
2. **Tests** — runs unit tests, integration tests, and frontend checks in parallel
3. **Creates GitHub Release** — with structured release notes parsed from changelog.ts
4. **Deploys to Azure** — runs `aspire deploy --non-interactive`
5. **Smoke tests** — verifies `/health` returns 200
6. **Updates Release** — appends deployed URL to the GitHub Release

### Manual Deploy-Only

To redeploy without a new release (e.g., config change):

- **From GitHub**: Actions → **Release & Deploy** → **Run workflow** → check "Skip tests"
- **From CLI**: `aspire deploy`

### Manual from CLI

For local development or debugging deployments:

```bash
aspire deploy
```

Subsequent deploys are faster — only the container image is rebuilt and redeployed. Infrastructure changes are applied incrementally via Bicep.

## Getting Your App URL

After deployment completes, the CLI prints the Container App URL. You can also find it:

```bash
az containerapp show --name api --resource-group <your-rg> \
  --query "properties.configuration.ingress.fqdn" -o tsv
```

Your app is live at `https://api.<environment-domain>.azurecontainerapps.io`.

## What Happens on First Startup

When the API container starts in production for the first time:

1. **EF Core migrations run** — Creates all database tables in the Azure PostgreSQL instance
2. **Curriculum is loaded** — Reads `worlds.yaml`, lesson markdown, quizzes, and challenges from the container filesystem and seeds the database
3. **Health check passes** — `/health` returns 200, Container Apps marks the app as healthy

This is automatic. No manual database setup is needed.

## Publish Only (No Deploy)

To generate the Bicep templates without deploying:

```bash
aspire publish -o ./aspire-output
```

This creates:
```
aspire-output/
├── main.bicep                    # Top-level orchestrator
├── aca-env/aca-env.bicep         # Container Apps Environment + Log Analytics
├── aca-env-acr/aca-env-acr.bicep # Azure Container Registry
├── postgres/postgres.bicep       # PostgreSQL Flexible Server
├── api/api.bicep                 # API Container App
├── api-identity/                 # Managed Identity
└── api-roles-postgres/           # PostgreSQL RBAC
```

You can inspect, customize, or deploy these manually with `az deployment sub create`.

## Configuration Details

### Environment Variables (Set Automatically)

These are injected by Aspire into the container at deploy time:

| Variable | Source |
|----------|--------|
| `ConnectionStrings__academydb` | Azure PostgreSQL connection string (with Entra ID auth) |
| `ConnectionStrings__openai` | AI connection string — Azure AI Foundry endpoint or OpenAI key (stored as ACA secret) |
| `Jwt__Key` | From your input (stored as ACA secret) |
| `AZURE_CLIENT_ID` | Managed identity client ID |
| `HTTP_PORTS` | Container port (auto-assigned) |

### Authentication

- **PostgreSQL**: Entra ID authentication via managed identity (no password)
- **AI (Azure AI Foundry / OpenAI)**: Connection string with endpoint+key or API key (stored as ACA secret)
- **JWT**: Symmetric key (stored as ACA secret)

### Scaling

Default: 1 replica minimum. To adjust:

```bash
az containerapp update --name api --resource-group <your-rg> \
  --min-replicas 1 --max-replicas 5
```

## Cost Estimate

For a minimal deployment (Burstable tier, single replica):

| Resource | ~Monthly Cost |
|----------|--------------|
| Container Apps (1 replica, 0.5 vCPU / 1 GB) | ~$15 |
| PostgreSQL Flexible Server (B1ms) | ~$13 |
| Container Registry (Basic) | ~$5 |
| Log Analytics | ~$2-5 |
| **Total** | **~$35-40/month** |

## Troubleshooting

### Deploy fails at "process-parameters"

You need to provide values for `jwt-key` and `openai` connection string (which accepts Azure AI Foundry or OpenAI). Run `aspire deploy` (not `--non-interactive`) to get the interactive prompts. This happens on first deploy before secrets are stored.

### Container starts but health check fails

Check container logs:

```bash
az containerapp logs show --name api --resource-group <your-rg> --type console
```

Common causes:
- Database migration failed (check PostgreSQL firewall rules)
- Missing or invalid AI connection string (check `ConnectionStrings__openai`)
- JWT key too short (must be at least 32 characters)

### "MigrateAsync" fails on first deploy

The EF Core migration history table and initial migration must exist. If deploying from scratch, the API uses `MigrateAsync()` which applies the migration in `Migrations/20260326042829_InitialCreate.cs`. Ensure that migration file is up to date with your model.

### GitHub Actions deploy fails with "AADSTS70021"

The federated credential subject doesn't match. Verify the credential was created with `repo:adamint/AspireAcademy:environment:production` and that the deploy job has `environment: production` set.
