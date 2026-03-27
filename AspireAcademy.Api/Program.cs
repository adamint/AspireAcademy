using System.Text;
using System.Threading.RateLimiting;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using AspireAcademy.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddNpgsqlDbContext<AcademyDbContext>("academydb");
builder.AddRedisClient("cache");
builder.Services.AddOpenApi();

// Services
builder.Services.AddScoped<GamificationService>();
builder.Services.AddScoped<CurriculumLoader>();
builder.Services.AddSingleton<AiTutorService>();
builder.Services.AddSingleton<CodeCheckerService>();

// JWT authentication — key is always injected by the AppHost (or test harness)
var jwtSecret = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException(
        "Missing 'Jwt:Key' configuration. The AppHost must inject this value.");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "AspireAcademy";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization();

// Build the list of allowed CORS origins dynamically from Aspire-injected env vars
var aspireOrigins = new List<string>();
foreach (var kvp in builder.Configuration.AsEnumerable())
{
    if (kvp.Key.StartsWith("services__web__", StringComparison.OrdinalIgnoreCase) &&
        kvp.Value is { Length: > 0 } url)
    {
        aspireOrigins.Add(url.TrimEnd('/'));
    }
}

var corsOrigins = new List<string>(aspireOrigins);
if (builder.Environment.IsDevelopment() || builder.Environment.EnvironmentName == "Testing")
{
    // Keep localhost fallback only for local dev without Aspire
    corsOrigins.Add("http://localhost:5173");
}

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactDev", policy =>
    {
        policy.WithOrigins(corsOrigins.Distinct().ToArray())
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// Rate limiting on auth endpoints
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Only allow test-client bypass in Testing/Development environments
    var isDev = builder.Environment.IsDevelopment() || builder.Environment.EnvironmentName == "Testing";

    options.AddPolicy("register", httpContext =>
        isDev && httpContext.Request.Headers.ContainsKey("X-Test-Client")
            ? RateLimitPartition.GetNoLimiter(string.Empty)
            : RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 5,
                    Window = TimeSpan.FromMinutes(1)
                }));

    options.AddPolicy("login", httpContext =>
        isDev && httpContext.Request.Headers.ContainsKey("X-Test-Client")
            ? RateLimitPartition.GetNoLimiter(string.Empty)
            : RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(1)
                }));
});

var app = builder.Build();

// Initialize database schema and load curriculum on startup (all environments).
// In dev: uses EnsureCreated (drop/recreate on schema mismatch).
// In production: applies EF Core migrations, then loads curriculum if empty.
{
    try
    {
        app.Logger.LogInformation("Starting database initialization...");
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

        if (app.Environment.IsDevelopment() || app.Environment.EnvironmentName == "Testing")
        {
            app.Logger.LogInformation("Dev/Testing mode — using EnsureCreated");
            var created = await db.Database.EnsureCreatedAsync();
            if (!created)
            {
                try
                {
                    await db.Worlds.AnyAsync();
                    app.Logger.LogInformation("Worlds table exists, schema is intact");
                }
                catch
                {
                    app.Logger.LogWarning("Schema mismatch — recreating (dev only)");
                    await db.Database.EnsureDeletedAsync();
                    await db.Database.EnsureCreatedAsync();
                }
            }
        }
        else
        {
            app.Logger.LogInformation("Production mode — applying EF Core migrations");
            await db.Database.MigrateAsync();
        }

        // Load curriculum if the database is empty (first deploy or after flush).
        // Skip in Testing — tests seed their own data.
        if (app.Environment.EnvironmentName != "Testing")
        {
            var worldCount = await db.Worlds.CountAsync();
            if (worldCount == 0)
            {
                app.Logger.LogInformation("No curriculum data found — running CurriculumLoader...");
                var loader = scope.ServiceProvider.GetRequiredService<CurriculumLoader>();
                await loader.LoadAsync();

                worldCount = await db.Worlds.CountAsync();
                var moduleCount = await db.Modules.CountAsync();
                var lessonCount = await db.Lessons.CountAsync();
                app.Logger.LogInformation("Curriculum loaded: {WorldCount} worlds, {ModuleCount} modules, {LessonCount} lessons",
                    worldCount, moduleCount, lessonCount);
            }
            else
            {
                app.Logger.LogInformation("Curriculum already loaded ({WorldCount} worlds)", worldCount);
            }
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to initialize database or load curriculum. The app will start but data may be missing.");
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("ReactDev");
app.UseRateLimiter();

// Auth-endpoint guard: reject non-browser requests to /api/auth/register and /api/auth/login
// unless they carry the test-client header in dev/testing environments.
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value;
    if (path is not null &&
        (path.StartsWith("/api/auth/register", StringComparison.OrdinalIgnoreCase) ||
         path.StartsWith("/api/auth/login", StringComparison.OrdinalIgnoreCase)))
    {
        // Allow test clients only in dev/testing environments
        var env = context.RequestServices.GetRequiredService<IWebHostEnvironment>();
        var isDev = env.IsDevelopment() || env.EnvironmentName == "Testing";

        if (!(isDev && context.Request.Headers.ContainsKey("X-Test-Client")))
        {
            // Require an Origin header (browsers always send one for non-GET)
            var origin = context.Request.Headers.Origin.FirstOrDefault();
            if (string.IsNullOrEmpty(origin) || origin == "null")
            {
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new ErrorResponse("Direct API access to auth endpoints is not allowed."));
                return;
            }
        }
    }

    await next();
});

app.UseAuthentication();
app.UseAuthorization();

app.MapDefaultEndpoints();

// Serve React SPA static files in production (bundled via PublishWithContainerFiles)
if (!app.Environment.IsDevelopment())
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

// Wire all API endpoint groups
app.MapAuthEndpoints();
app.MapCurriculumEndpoints();
app.MapQuizEndpoints();
app.MapChallengeEndpoints();
app.MapGamificationEndpoints();
app.MapSocialEndpoints();
app.MapAiTutorEndpoints();
app.MapAdminEndpoints();
app.MapCertificateEndpoints();
app.MapSettingsEndpoints();
app.MapWeeklyChallengeEndpoints();

// SPA fallback: serve index.html for non-API, non-file routes (React Router)
if (!app.Environment.IsDevelopment())
{
    app.MapFallbackToFile("index.html");
}

app.Run();

public partial class Program { }
