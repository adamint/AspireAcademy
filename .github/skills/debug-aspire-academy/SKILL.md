# Debug AspireAcademy Skill

A debugging guide for the AspireAcademy distributed application. Use this when diagnosing runtime errors, connectivity issues, or unexpected behavior across services.

## Checking Aspire Dashboard Structured Logs

The Aspire Dashboard is the first place to look when something goes wrong.

1. Open the Aspire Dashboard (typically at `http://localhost:15888` or the URL shown in AppHost console output).
2. Navigate to **Structured Logs** in the left sidebar.
3. Filter by resource name (e.g., `api`, `coderunner`, `web`) to isolate logs for a specific service.
4. Filter by log level — set to **Error** or **Warning** to surface problems quickly.
5. Click on individual log entries to see structured properties, exception details, and stack traces.
6. Use **Traces** view to follow a request across services and identify where failures occur.
7. Check the **Resources** page to see if any service is in a failed or unhealthy state.

## Adding ILogger Diagnostic Logging to API Endpoints

When you need more visibility into API behavior, inject `ILogger` and add targeted logging:

```csharp
app.MapPost("/api/exercises/submit", async (
    SubmitRequest request,
    ILogger<Program> logger,
    ExerciseService service) =>
{
    logger.LogInformation("Submission received for exercise {ExerciseId} by user {UserId}",
        request.ExerciseId, request.UserId);

    try
    {
        var result = await service.EvaluateAsync(request);
        logger.LogInformation("Submission result: {Passed}, output length: {Length}",
            result.Passed, result.Output?.Length ?? 0);
        return Results.Ok(result);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to evaluate submission for exercise {ExerciseId}",
            request.ExerciseId);
        return Results.Problem("Internal error evaluating submission");
    }
});
```

These logs will appear in the Aspire Dashboard structured logs view automatically via OpenTelemetry.

## Adding console.log to React Components

For debugging the React frontend (`AspireAcademy.Web`):

```tsx
// In component render or useEffect
useEffect(() => {
    console.log("[ExercisePage] Fetching exercise:", exerciseId);
    console.log("[ExercisePage] Auth token present:", !!token);
    console.log("[ExercisePage] API base URL:", import.meta.env.VITE_API_URL);

    fetch(`${apiUrl}/api/exercises/${exerciseId}`, { headers })
        .then(res => {
            console.log("[ExercisePage] Response status:", res.status);
            return res.json();
        })
        .then(data => console.log("[ExercisePage] Data:", data))
        .catch(err => console.error("[ExercisePage] Fetch error:", err));
}, [exerciseId]);
```

Tips:
- Prefix logs with `[ComponentName]` to filter in browser DevTools.
- Check the **Network** tab for HTTP status codes and response bodies.
- Check the **Console** tab for CORS errors (they show as red text with `Access-Control` mentions).

## Restarting Services via Aspire

When a service gets into a bad state, restart it:

```bash
# Stop the entire AppHost
# Press Ctrl+C in the terminal running the AppHost

# Restart the AppHost
cd AspireAcademy.AppHost
dotnet run

# Alternatively, use the Aspire Dashboard:
# 1. Go to Resources page
# 2. Click the stop/restart button next to the resource
```

If using the Aspire MCP tools:

```
# List resources to check state
aspire-list_resources

# Restart a specific resource
aspire-execute_resource_command (resourceName: "api", commandName: "restart")
aspire-execute_resource_command (resourceName: "coderunner", commandName: "restart")
```

## Checking if Database Migrations Have Applied

```bash
# Check migration status via EF Core CLI
cd AspireAcademy.Api
dotnet ef migrations list

# Check if the database has pending migrations
dotnet ef database update --dry-run

# If migrations are pending, apply them
dotnet ef database update
```

You can also check at runtime by adding a startup log:

```csharp
// In Program.cs after building the app
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var pending = await db.Database.GetPendingMigrationsAsync();
    if (pending.Any())
    {
        logger.LogWarning("Pending migrations: {Migrations}", string.Join(", ", pending));
    }
    else
    {
        logger.LogInformation("All database migrations are applied.");
    }
}
```

## Checking Redis Connectivity

```bash
# If Redis is running as an Aspire resource, check via dashboard
# Resources page will show Redis container state and health

# Connect via redis-cli (if available)
redis-cli -p <port> ping
# Expected response: PONG

# Check from application code — add a health check log
```

In code, verify the connection:

```csharp
app.MapGet("/debug/redis", async (IConnectionMultiplexer redis, ILogger<Program> logger) =>
{
    try
    {
        var db = redis.GetDatabase();
        await db.PingAsync();
        logger.LogInformation("Redis ping successful");
        return Results.Ok("Redis connected");
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Redis connection failed");
        return Results.Problem("Redis connection failed: " + ex.Message);
    }
});
```

## Common Issues and Solutions

### CORS Errors

**Symptom:** Browser console shows `Access to fetch at '...' has been blocked by CORS policy`.

**Fix:** Ensure the API project has CORS configured for the frontend origin:

```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173", "https://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Must be called before MapControllers/MapEndpoints
app.UseCors();
```

Check the Aspire Dashboard to find the actual frontend URL and make sure it is in the allowed origins list.

### JWT Token Expired

**Symptom:** API returns `401 Unauthorized` after the user has been idle.

**Diagnosis:**
1. Check the browser's Application/Storage tab for the JWT token.
2. Decode the token at [jwt.io](https://jwt.io) and check the `exp` claim.
3. Compare with current UTC time.

**Fix:**
- Implement token refresh logic in the frontend.
- Increase token expiry in API configuration for development.
- Add a `401` response interceptor in the frontend HTTP client to trigger re-authentication.

### CodeRunner Timeout

**Symptom:** Code execution requests hang or return timeout errors.

**Diagnosis:**
1. Check Aspire Dashboard structured logs for the `coderunner` resource.
2. Look for `SemaphoreSlim` exhaustion — if all 5 slots are in use, new requests queue.
3. Check if the child `dotnet` process is hanging (infinite loops in user code).

**Fix:**
- Ensure the `timeoutSeconds` parameter is set in requests (default should be reasonable, e.g., 30s).
- Check that the CodeRunner's `CompilationService` properly kills timed-out processes.
- Restart the CodeRunner resource if it is stuck.

```bash
# Check CodeRunner health
curl http://localhost:<port>/health
```

### Database Connection Refused

**Symptom:** API logs show `Npgsql.NpgsqlException: Failed to connect` or `Connection refused`.

**Diagnosis:**
1. Check the Aspire Dashboard Resources page — is the database container running?
2. Check the database container logs in the Aspire Dashboard console logs.
3. Verify the connection string in the API's configuration.

**Fix:**
- Restart the database resource via the Aspire Dashboard.
- Ensure the AppHost is correctly configuring the database resource and passing the connection to the API project via `WithReference`.
- Check if another process is using the same port.

```csharp
// Verify in AppHost that the reference is wired correctly
var db = builder.AddPostgres("postgres").AddDatabase("aspireacademy");

var api = builder.AddProject<Projects.AspireAcademy_Api>("api")
    .WithReference(db);
```

### General Debugging Checklist

1. **Check Aspire Dashboard** — Resources page for service health, Structured Logs for errors, Traces for request flow.
2. **Check container status** — `docker ps` to verify all containers are running.
3. **Check endpoints** — Hit `/health` on each service to verify it's responding.
4. **Check environment variables** — Aspire injects connection strings and service URLs via environment variables. Log `Environment.GetEnvironmentVariables()` at startup if unsure.
5. **Rebuild and restart** — When in doubt, stop the AppHost, rebuild with `dotnet build`, and restart.

## IMPORTANT: Do NOT delete the PostgreSQL data volume

**NEVER run `docker volume rm aspire-academy-pgdata` unless:**
1. The database schema has changed AND migrations won't work
2. The user explicitly asks to reset their data

User progress, accounts, and achievements are stored in this volume. Deleting it destroys all user data. The app should handle stale/old schemas gracefully via EnsureCreated or migrations — not by wiping the database.

When restarting the app, just use `aspire run` without touching the volume.
