using System.Security.Claims;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

public static class AdminEndpoints
{
    public static WebApplication MapAdminEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/admin")
            .WithTags("Admin")
            .RequireAuthorization();

        group.MapGet("/stats", GetStats);
        group.MapPost("/reload-curriculum", ReloadCurriculum);
        group.MapPost("/flush-db", FlushDatabase);
        group.MapGet("/users", GetUsers);
        group.MapDelete("/users/{userId:guid}", DeleteUser);
        group.MapPost("/seed-test-data", SeedTestData);
        group.MapGet("/seeded-credentials", GetSeededCredentials);

        // AppHost internal commands bypass JWT auth but require a shared secret
        var internalGroup = app.MapGroup("/api/admin")
            .WithTags("Admin-Internal")
            .AllowAnonymous();

        internalGroup.MapPost("/reload-curriculum-internal", ReloadCurriculum);
        internalGroup.MapPost("/seed-test-data-internal", SeedTestData);
        internalGroup.MapPost("/flush-db-internal", FlushDatabase);

        return app;
    }

    // Default test credentials — only exposed in Development/Testing environments
    private static readonly string s_testUserPassword = "TestPass1";
    private static readonly string s_adminPassword = "AdminPass1!";

    private static List<SeededUserInfo> GetSeededCredentialsList() =>
    [
        new("testuser", s_testUserPassword, "test@aspireacademy.dev", "Pre-seeded test learner with sample progress"),
        new("admin", s_adminPassword, "admin@aspireacademy.dev", "Admin user with full access to /admin panel"),
    ];

    private static IResult GetSeededCredentials(ClaimsPrincipal principal, HttpRequest request, IWebHostEnvironment env)
    {
        if (!IsAdmin(principal, request))
        {
            return Forbidden();
        }
        if (!env.IsDevelopment() && env.EnvironmentName != "Testing")
        {
            return Results.Json(new ErrorResponse("Seeded credentials are only available in development."), statusCode: 403);
        }
        return Results.Ok(GetSeededCredentialsList());
    }

    private static IResult Forbidden() =>
        Results.Json(new ErrorResponse("Admin access required."), statusCode: 403);

    private static bool IsAdmin(ClaimsPrincipal principal, HttpRequest request)
    {
        // JWT-based admin check
        var username = principal.FindFirstValue(ClaimTypes.Name);
        if (string.Equals(username, "admin", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        // Internal AppHost command bypass (for Aspire Dashboard commands)
        var expectedSecret = request.HttpContext.RequestServices
            .GetRequiredService<IConfiguration>()["Admin:InternalSecret"];

        if (!string.IsNullOrEmpty(expectedSecret))
        {
            var headerValue = request.Headers["X-Aspire-Admin"].FirstOrDefault();
            return string.Equals(headerValue, expectedSecret, StringComparison.Ordinal);
        }

        return false;
    }

    private static async Task<IResult> GetStats(
        ClaimsPrincipal principal,
        HttpRequest request,
        AcademyDbContext db,
        ILogger<AcademyDbContext> logger)
    {
        if (!IsAdmin(principal, request))
        {
            return Forbidden();
        }

        logger.LogInformation("Admin action: GetStats requested by {User}", principal.FindFirstValue(ClaimTypes.Name));

        var totalUsers = await db.Users.CountAsync();
        var totalLessonsCompleted = await db.UserProgress
            .CountAsync(p => p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect);
        var totalXpEarned = await db.UserXp.SumAsync(x => (long)x.TotalXp);
        var activeUsersSince = DateTime.UtcNow.AddDays(-7);
        var activeUsers = await db.Users.CountAsync(u => u.LastLoginAt != null && u.LastLoginAt >= activeUsersSince);

        var worldsCount = await db.Worlds.CountAsync();
        var modulesCount = await db.Modules.CountAsync();
        var lessonsCount = await db.Lessons.CountAsync();

        return Results.Ok(new AdminStatsResponse(
            TotalUsers: totalUsers,
            TotalLessonsCompleted: totalLessonsCompleted,
            TotalXpEarned: totalXpEarned,
            ActiveUsers: activeUsers,
            WorldsCount: worldsCount,
            ModulesCount: modulesCount,
            LessonsCount: lessonsCount));
    }

    private static async Task<IResult> ReloadCurriculum(
        ClaimsPrincipal principal,
        HttpRequest request,
        IServiceProvider services,
        ILogger<CurriculumLoader> logger)
    {
        if (!IsAdmin(principal, request))
        {
            return Forbidden();
        }

        logger.LogInformation("Admin action: ReloadCurriculum requested by {User}", principal.FindFirstValue(ClaimTypes.Name));

        await using var scope = services.CreateAsyncScope();
        var loader = scope.ServiceProvider.GetRequiredService<CurriculumLoader>();
        await loader.LoadAsync();

        logger.LogInformation("Admin action: Curriculum reload completed");
        return Results.Ok(new AdminActionResponse("Curriculum reloaded successfully."));
    }

    private static async Task<IResult> FlushDatabase(
        ClaimsPrincipal principal,
        HttpRequest request,
        AcademyDbContext db,
        IServiceProvider services,
        IWebHostEnvironment env,
        ILogger<AcademyDbContext> logger)
    {
        if (!IsAdmin(principal, request))
        {
            return Forbidden();
        }

        if (!env.IsDevelopment())
        {
            return Results.Json(new ErrorResponse("Flush database is only available in development."), statusCode: 403);
        }

        logger.LogWarning("Admin action: FlushDatabase requested by {User}", principal.FindFirstValue(ClaimTypes.Name));

        await db.Database.EnsureDeletedAsync();
        await db.Database.EnsureCreatedAsync();

        await using var scope = services.CreateAsyncScope();
        var loader = scope.ServiceProvider.GetRequiredService<CurriculumLoader>();
        await loader.LoadAsync();

        logger.LogWarning("Admin action: Database flushed and curriculum reloaded");
        return Results.Ok(new AdminActionResponse("Database flushed and curriculum reloaded."));
    }

    private static async Task<IResult> GetUsers(
        ClaimsPrincipal principal,
        HttpRequest request,
        AcademyDbContext db,
        ILogger<AcademyDbContext> logger,
        int page = 1,
        int pageSize = 20,
        string? search = null)
    {
        if (!IsAdmin(principal, request))
        {
            return Forbidden();
        }

        logger.LogInformation("Admin action: GetUsers page={Page} search={Search}", page, search);

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        IQueryable<User> query = db.Users.Include(u => u.Xp);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.ToLowerInvariant();
            query = query.Where(u =>
                u.Username.ToLower().Contains(term) ||
                u.Email.ToLower().Contains(term) ||
                u.DisplayName.ToLower().Contains(term));
        }

        var totalCount = await query.CountAsync();
        var users = await query
            .OrderByDescending(u => u.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new AdminUserDto(
                u.Id,
                u.Username,
                u.Email,
                u.DisplayName,
                u.Xp != null ? u.Xp.CurrentLevel : 1,
                u.Xp != null ? u.Xp.TotalXp : 0,
                u.LastLoginAt,
                u.CreatedAt))
            .ToListAsync();

        return Results.Ok(new AdminUsersResponse(users, totalCount, page, pageSize));
    }

    private static async Task<IResult> DeleteUser(
        Guid userId,
        ClaimsPrincipal principal,
        HttpRequest request,
        AcademyDbContext db,
        ILogger<AcademyDbContext> logger)
    {
        if (!IsAdmin(principal, request))
        {
            return Forbidden();
        }

        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return Results.NotFound(new ErrorResponse("User not found."));
        }

        logger.LogWarning("Admin action: DeleteUser {UserId} ({Username}) requested by {Admin}",
            userId, user.Username, principal.FindFirstValue(ClaimTypes.Name));

        db.Users.Remove(user);
        await db.SaveChangesAsync();

        logger.LogWarning("Admin action: User {UserId} deleted", userId);
        return Results.Ok(new AdminActionResponse($"User '{user.Username}' deleted."));
    }

    private static async Task<IResult> SeedTestData(
        ClaimsPrincipal principal,
        HttpRequest request,
        AcademyDbContext db,
        IWebHostEnvironment env,
        ILogger<AcademyDbContext> logger)
    {
        if (!IsAdmin(principal, request))
        {
            return Forbidden();
        }

        if (!env.IsDevelopment() && env.EnvironmentName != "Testing")
        {
            return Results.Json(new ErrorResponse("Seeding test data is only available in development."), statusCode: 403);
        }

        logger.LogInformation("Admin action: SeedTestData requested by {User}", principal.FindFirstValue(ClaimTypes.Name));

        var now = DateTime.UtcNow;

        // Check if test user already exists
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Username == "testuser");
        if (existing is not null)
        {
            // Still create admin user if missing, even when testuser exists
            var adminExistsEarly = await db.Users.AnyAsync(u => u.Username == "admin");
            if (!adminExistsEarly)
            {
                await CreateAdminUser(db, logger, now);
            }

            return Results.Conflict(new ErrorResponse("Test user 'testuser' already exists."));
        }

        var testUser = new User
        {
            Id = Guid.CreateVersion7(),
            Username = "testuser",
            Email = "test@aspireacademy.dev",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(s_testUserPassword),
            DisplayName = "Test Learner",
            LoginStreakDays = 5,
            LastStreakDate = DateOnly.FromDateTime(now),
            LastLoginAt = now,
            CreatedAt = now
        };

        var testXp = new UserXp
        {
            UserId = testUser.Id,
            TotalXp = 450,
            WeeklyXp = 150,
            CurrentLevel = 3,
            CurrentRank = "junior-dev",
            WeekStart = DateOnly.FromDateTime(now)
        };

        db.Users.Add(testUser);
        db.UserXp.Add(testXp);

        // Add some progress on the first few lessons if they exist
        var firstLessons = await db.Lessons.OrderBy(l => l.SortOrder).Take(3).ToListAsync();
        foreach (var lesson in firstLessons)
        {
            db.UserProgress.Add(new UserProgress
            {
                Id = Guid.CreateVersion7(),
                UserId = testUser.Id,
                LessonId = lesson.Id,
                Status = ProgressStatuses.Completed,
                Attempts = 1,
                Score = 100,
                MaxScore = 100,
                XpEarned = lesson.XpReward,
                CompletedAt = now.AddHours(-Random.Shared.Next(1, 72))
            });
        }

        await db.SaveChangesAsync();

        logger.LogInformation("Admin action: Test data seeded — user 'testuser' created with {LessonCount} completed lessons", firstLessons.Count);

        // Also create admin user if it doesn't exist
        var adminExists = await db.Users.AnyAsync(u => u.Username == "admin");
        if (!adminExists)
        {
            await CreateAdminUser(db, logger, now);
        }

        return Results.Ok(new AdminActionResponse(
            $"Test data seeded: 'testuser' and 'admin' users created with {firstLessons.Count} completed lessons. " +
            "View credentials at GET /api/admin/seeded-credentials (dev only)."));
    }
    private static async Task CreateAdminUser(AcademyDbContext db, ILogger logger, DateTime now)
    {
        var adminUser = new User
        {
            Id = Guid.CreateVersion7(),
            Username = "admin",
            Email = "admin@aspireacademy.dev",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(s_adminPassword),
            DisplayName = "Admin",
            CreatedAt = now
        };
        db.Users.Add(adminUser);
        db.UserXp.Add(new UserXp
        {
            UserId = adminUser.Id,
            TotalXp = 0,
            CurrentLevel = 1,
            CurrentRank = Ranks.AspireIntern,
            WeekStart = DateOnly.FromDateTime(now)
        });
        await db.SaveChangesAsync();
        logger.LogInformation("Admin action: Admin user created (username=admin)");
    }
}

// ── Admin DTOs ──

public record AdminStatsResponse(
    int TotalUsers,
    int TotalLessonsCompleted,
    long TotalXpEarned,
    int ActiveUsers,
    int WorldsCount,
    int ModulesCount,
    int LessonsCount);

public record AdminActionResponse(string Message);

public record AdminUserDto(
    Guid Id,
    string Username,
    string Email,
    string DisplayName,
    int Level,
    int TotalXp,
    DateTime? LastLoginAt,
    DateTime CreatedAt);

public record AdminUsersResponse(
    List<AdminUserDto> Users,
    int TotalCount,
    int Page,
    int PageSize);

record SeededUserInfo(string Username, string Password, string Email, string Description);
