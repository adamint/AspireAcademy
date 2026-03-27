# Aspire Academy — Deployment Guide

This project uses **.NET Aspire's built-in publish/deploy pipeline** to deploy to Azure. The `aspire deploy` command generates Azure Bicep templates, provisions infrastructure, builds container images, and deploys everything in one step.

## What Gets Deployed

| Resource | Azure Service | Notes |
|----------|--------------|-------|
| API + React SPA | **Azure Container Apps** | React build is bundled into the API container as static files |
| PostgreSQL | **Azure Database for PostgreSQL Flexible Server** | Burstable B1ms, 32 GB, Entra ID auth (no passwords) |
| Redis | **Azure Cache for Redis** | Managed Redis, Entra ID auth via managed identity |
| Identity | **User-Assigned Managed Identity** | RBAC roles for PostgreSQL + Redis |
| Container Registry | **Azure Container Registry** | Auto-created for container images |
| Networking | **Container Apps Environment** | Shared environment with Log Analytics |

The React SPA is **not** deployed as a separate service. At publish time, Aspire runs `npm run build` and copies the output into the API container's `wwwroot/` folder. The API serves the SPA as static files in production.

## Prerequisites

1. **Azure CLI** — [Install](https://learn.microsoft.com/cli/azure/install-azure-cli)
2. **Aspire CLI** — `dotnet tool install -g aspire` (or update: `dotnet tool update -g aspire`)
3. **Docker Desktop** — Required for building container images
4. **Azure subscription** with permissions to create resource groups and resources
5. **Node.js 22+** — For building the React frontend

## Step-by-Step Deployment

### 1. Log in to Azure

```bash
az login
```

If you have multiple subscriptions, set the one you want:

```bash
az account set --subscription "Your Subscription Name"
```

### 2. Prepare Your Secrets

You'll need two values ready:

| Secret | Description |
|--------|-------------|
| **JWT signing key** | A random string, at least 32 characters. Used to sign auth tokens. |
| **OpenAI connection string** | `Key=sk-your-key` (OpenAI) or `Endpoint=https://your-resource.openai.azure.com;Key=your-key` (Azure OpenAI) |

Generate a JWT key:

```bash
openssl rand -base64 48
```

### 3. Deploy

From the project root:

```bash
aspire deploy
```

The CLI will interactively prompt you for:

1. **Azure tenant** — Select your Entra ID tenant
2. **Azure subscription** — Select the subscription to deploy to
3. **Resource group** — Enter a name (created if it doesn't exist)
4. **Location** — Azure region (e.g., `eastus`, `westus2`, `westeurope`)
5. **jwt-key** — Paste your JWT signing key
6. **openai connection string** — Paste your OpenAI/Azure OpenAI connection string

Then it will:
- Generate Bicep IaC templates
- Provision Azure infrastructure (~3-5 minutes for first deploy)
- Build the API container image (includes `npm run build` for the React SPA)
- Push the image to Azure Container Registry
- Deploy the container app

### 4. Get Your App URL

After deployment completes, the CLI prints the Container App URL. You can also find it:

```bash
# List your container apps
az containerapp list --resource-group <your-rg> --output table

# Get the URL directly
az containerapp show --name api --resource-group <your-rg> --query "properties.configuration.ingress.fqdn" -o tsv
```

Your app is live at `https://api.<environment-domain>.azurecontainerapps.io`.

## What Happens on First Startup

When the API container starts in production for the first time:

1. **EF Core migrations run** — Creates all database tables in the Azure PostgreSQL instance
2. **Curriculum is loaded** — Reads `worlds.yaml`, lesson markdown, quizzes, and challenges from the container filesystem and seeds the database
3. **Health check passes** — `/health` returns 200, Container Apps marks the app as healthy

This is automatic. No manual database setup is needed.

## Updating / Redeploying

### Automated (Recommended)

Push a version tag to trigger the full release & deploy pipeline:

```bash
./scripts/release.sh 1.5.0
```

This validates changelog → runs tests → creates a GitHub Release → deploys to Azure. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full release process.

You can also trigger a deploy-only run from GitHub Actions → **Release & Deploy** → **Run workflow**.

### Manual

```bash
aspire deploy
```

Subsequent deploys are faster — only the container image is rebuilt and redeployed. Infrastructure changes are applied incrementally via Bicep.

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
├── cache/cache.bicep             # Azure Cache for Redis
├── api/api.bicep                 # API Container App
├── api-identity/                 # Managed Identity
├── api-roles-postgres/           # PostgreSQL RBAC
└── api-roles-cache/              # Redis RBAC
```

You can inspect, customize, or deploy these manually with `az deployment sub create`.

## Configuration Details

### Environment Variables (Set Automatically)

These are injected by Aspire into the container at deploy time:

| Variable | Source |
|----------|--------|
| `ConnectionStrings__academydb` | Azure PostgreSQL connection string (with Entra ID auth) |
| `ConnectionStrings__cache` | Azure Redis connection string (with Entra ID auth) |
| `ConnectionStrings__openai` | From your input (stored as ACA secret) |
| `Jwt__Key` | From your input (stored as ACA secret) |
| `AZURE_CLIENT_ID` | Managed identity client ID |
| `HTTP_PORTS` | Container port (auto-assigned) |

### Authentication

- **PostgreSQL**: Entra ID authentication via managed identity (no password)
- **Redis**: Entra ID authentication via managed identity (no password)
- **OpenAI**: API key from connection string (stored as ACA secret)
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
| Azure Cache for Redis (Basic C0) | ~$16 |
| Container Registry (Basic) | ~$5 |
| Log Analytics | ~$2-5 |
| **Total** | **~$50-55/month** |

## Troubleshooting

### CI/CD Deploy: Setting Up Azure OIDC

The GitHub Actions deploy job uses OpenID Connect (OIDC) federated credentials — no stored Azure passwords.

#### 1. Create an Entra ID App Registration

```bash
az ad app create --display-name "AspireAcademy-Deploy"
APP_ID=$(az ad app list --display-name "AspireAcademy-Deploy" --query "[0].appId" -o tsv)

# Create a service principal
az ad sp create --id "$APP_ID"
```

#### 2. Add Federated Credential for GitHub Actions

```bash
az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-production",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:adamint/AspireAcademy:environment:production",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

#### 3. Grant Permissions

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
SP_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv)

# Contributor on the resource group (creates/updates resources)
az role assignment create --assignee "$SP_ID" \
  --role Contributor \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/<your-rg>"

# User Access Administrator (for managed identity role assignments)
az role assignment create --assignee "$SP_ID" \
  --role "User Access Administrator" \
  --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/<your-rg>"
```

#### 4. Configure GitHub

In your repo's **Settings → Environments**, create `production`.

In **Settings → Secrets and variables → Actions**:

| Type | Name | Value |
|------|------|-------|
| Secret | `AZURE_CLIENT_ID` | The app registration's Application (client) ID |
| Secret | `AZURE_TENANT_ID` | Your Entra ID tenant ID |
| Secret | `AZURE_SUBSCRIPTION_ID` | Target Azure subscription ID |
| Variable | `AZURE_RESOURCE_GROUP` | Resource group name |
| Variable | `AZURE_LOCATION` | Azure region (e.g., `eastus`) |

### Deploy fails at "process-parameters"

You need to provide values for `jwt-key` and `openai` connection string. Run `aspire deploy` (not `--non-interactive`) to get the interactive prompts.

### Container starts but health check fails

Check container logs:

```bash
az containerapp logs show --name api --resource-group <your-rg> --type console
```

Common causes:
- Database migration failed (check PostgreSQL firewall rules)
- Missing or invalid OpenAI connection string
- JWT key too short (must be at least 32 characters)

### "MigrateAsync" fails on first deploy

The EF Core migration history table and initial migration must exist. If deploying from scratch, the API uses `MigrateAsync()` which applies the migration in `Migrations/20260326042829_InitialCreate.cs`. Ensure that migration file is up to date with your model.

### Need to reset the database

Connect to PostgreSQL via Azure Portal's query editor or `psql`, then restart the container app. On next startup, the API will detect an empty database and reload curriculum.

### CORS errors

In production, the React SPA is served from the same origin as the API (both from the container). CORS is not needed. If you see CORS errors, you might be hitting the production API from a local dev frontend — use `aspire run` for local development instead.

## Tearing Down

To remove all deployed resources:

```bash
az group delete --name <your-resource-group> --yes --no-wait
```

This deletes everything: Container App, PostgreSQL, Redis, Container Registry, managed identity, and Log Analytics workspace.
