using System.Security.Claims;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

namespace AspireAcademy.Api.Endpoints;

public static class AdminEndpoints
{
    public static WebApplication MapAdminEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/admin")
            .WithTags("Admin");

        group.MapGet("/stats", GetStats);
        group.MapPost("/reload-curriculum", ReloadCurriculum);
        group.MapPost("/flush-db", FlushDatabase);
        group.MapPost("/flush-redis", FlushRedis);
        group.MapGet("/users", GetUsers);
        group.MapDelete("/users/{userId:guid}", DeleteUser);
        group.MapPost("/seed-test-data", SeedTestData);

        return app;
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
        return string.Equals(
            request.Headers["X-Aspire-Admin"].FirstOrDefault(),
            "aspire-internal",
            StringComparison.Ordinal);
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
            .CountAsync(p => p.Status == "completed" || p.Status == "perfect");
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

    private static async Task<IResult> FlushRedis(
        ClaimsPrincipal principal,
        HttpRequest request,
        IConnectionMultiplexer redis,
        ILogger<AcademyDbContext> logger)
    {
        if (!IsAdmin(principal, request))
        {
            return Forbidden();
        }

        logger.LogWarning("Admin action: FlushRedis requested by {User}", principal.FindFirstValue(ClaimTypes.Name));

        var server = redis.GetServers().First();
        await server.FlushAllDatabasesAsync();

        logger.LogWarning("Admin action: Redis flushed");
        return Results.Ok(new AdminActionResponse("Redis cache flushed."));
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
        ILogger<AcademyDbContext> logger)
    {
        if (!IsAdmin(principal, request))
        {
            return Forbidden();
        }

        logger.LogInformation("Admin action: SeedTestData requested by {User}", principal.FindFirstValue(ClaimTypes.Name));

        // Check if test user already exists
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Username == "testuser");
        if (existing is not null)
        {
            return Results.Conflict(new ErrorResponse("Test user 'testuser' already exists."));
        }

        var now = DateTime.UtcNow;
        var testUser = new User
        {
            Id = Guid.CreateVersion7(),
            Username = "testuser",
            Email = "test@aspireacademy.dev",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("TestPass1"),
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
                Status = "completed",
                Attempts = 1,
                Score = 100,
                MaxScore = 100,
                XpEarned = lesson.XpReward,
                CompletedAt = now.AddHours(-Random.Shared.Next(1, 72))
            });
        }

        await db.SaveChangesAsync();

        logger.LogInformation("Admin action: Test data seeded — user 'testuser' created with {LessonCount} completed lessons", firstLessons.Count);
        return Results.Ok(new AdminActionResponse($"Test user 'testuser' created with {firstLessons.Count} completed lessons. Password: TestPass1"));
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
