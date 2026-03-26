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
builder.Services.AddHttpClient("coderunner", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["services:coderunner:http:0"] ?? "http://localhost:8080");
    client.Timeout = TimeSpan.FromSeconds(60);
});

// JWT authentication
var jwtSecret = builder.Configuration["Jwt:Key"] ?? "dev-secret-key-change-in-production-min-32-chars!!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "AspireAcademy";

// Fail fast if the default dev key is used in production
if (!builder.Environment.IsDevelopment() && builder.Environment.EnvironmentName != "Testing" &&
    jwtSecret == "dev-secret-key-change-in-production-min-32-chars!!")
{
    throw new InvalidOperationException(
        "SECURITY: The default development JWT signing key must not be used in production. " +
        "Set the 'Jwt:Key' configuration value to a unique, random string of at least 32 characters.");
}

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

// Auto-migrate and load curriculum in Development
if (app.Environment.IsDevelopment())
{
    try
    {
        app.Logger.LogInformation("Starting database initialization...");
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

        app.Logger.LogInformation("Database connection string: {ConnStr}",
            db.Database.GetConnectionString()?[..Math.Min(80, db.Database.GetConnectionString()?.Length ?? 0)] + "...");

        // EnsureCreated works for new DBs; for existing ones with missing tables,
        // drop and recreate (dev only — production would use migrations)
        app.Logger.LogInformation("Calling EnsureCreatedAsync...");
        var created = await db.Database.EnsureCreatedAsync();
        app.Logger.LogInformation("EnsureCreatedAsync returned created={Created}", created);

        if (!created)
        {
            // DB exists but might be missing tables — check by trying a simple query
            try
            {
                await db.Worlds.AnyAsync();
                app.Logger.LogInformation("Worlds table exists, schema is intact");
            }
            catch (Exception schemaEx)
            {
                app.Logger.LogWarning(schemaEx, "Worlds table query failed — recreating schema");
                // Tables don't exist — recreate schema
                await db.Database.EnsureDeletedAsync();
                await db.Database.EnsureCreatedAsync();
                app.Logger.LogInformation("Schema recreated successfully");
            }
        }

        app.Logger.LogInformation("Running CurriculumLoader...");
        var loader = scope.ServiceProvider.GetRequiredService<CurriculumLoader>();
        await loader.LoadAsync();

        // Verify what was loaded
        var worldCount = await db.Worlds.CountAsync();
        var moduleCount = await db.Modules.CountAsync();
        var lessonCount = await db.Lessons.CountAsync();
        app.Logger.LogInformation("Curriculum load complete: {WorldCount} worlds, {ModuleCount} modules, {LessonCount} lessons",
            worldCount, moduleCount, lessonCount);

        if (worldCount == 0)
        {
            app.Logger.LogWarning(
                "WARNING: 0 worlds loaded! Check that worlds.yaml exists at {Path} and contains valid YAML with a 'worlds:' root key",
                Path.Combine(app.Environment.ContentRootPath, "Curriculum", "worlds.yaml"));
        }
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Failed to initialize database or load curriculum. The app will start but data may be missing. Exception: {Message}\n{StackTrace}",
            ex.Message, ex.StackTrace);
    }

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

// Wire all API endpoint groups
app.MapAuthEndpoints();
app.MapCurriculumEndpoints();
app.MapQuizEndpoints();
app.MapChallengeEndpoints();
app.MapGamificationEndpoints();
app.MapSocialEndpoints();
app.MapAiTutorEndpoints();
app.MapAdminEndpoints();

app.Run();

public partial class Program { }
