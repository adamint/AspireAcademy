using System.Security.Claims;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using AspireAcademy.Api.Telemetry;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

// ── Response DTOs ──

public record XpStatsResponse(
    int TotalXp,
    int CurrentLevel,
    string CurrentRank,
    int WeeklyXp,
    int XpToNextLevel,
    int XpForCurrentLevel,
    int LoginStreakDays,
    List<XpEventDto> RecentEvents);

public record XpEventDto(Guid Id, int XpAmount, string SourceType, string? SourceId, DateTime CreatedAt);

public record ProgressCompleteRequest(string LessonId);

public record ProgressCompleteResponse(
    int XpEarned,
    int BonusXpEarned,
    int TotalXp,
    int CurrentLevel,
    LevelUpInfo? LevelUp,
    List<AchievementUnlocked> AchievementsUnlocked);

public record SkipRequest(string LessonId);
public record SkipResponse(bool Skipped, string LessonId);
public record UnskipResponse(bool Unskipped, string LessonId);

public record AchievementDto(
    string Id,
    string Name,
    string Description,
    string Icon,
    string Category,
    string Rarity,
    bool IsUnlocked,
    DateTime? UnlockedAt,
    int XpReward);

public record AvatarRandomizeResponse(string AvatarUrl);

public static class GamificationEndpoints
{
    private static ILogger s_logger = null!;

    public static WebApplication MapGamificationEndpoints(this WebApplication app)
    {
        s_logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("GamificationEndpoints");

        var group = app.MapGroup("/api").RequireAuthorization();

        group.MapGet("/xp", GetXpStatsAsync);
        group.MapPost("/progress/complete", CompleteLessonAsync);
        group.MapPost("/progress/skip", SkipLessonAsync);
        group.MapPost("/progress/unskip", UnskipLessonAsync);
        group.MapGet("/achievements", GetAchievementsAsync);
        group.MapPost("/avatar/randomize", RandomizeAvatarAsync);
        group.MapDelete("/avatar", ClearAvatarAsync);

        return app;
    }

    private static async Task<IResult> GetXpStatsAsync(
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = GetUserId(user);

        var userXp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId);
        var dbUser = await db.Users.FindAsync(userId);

        if (dbUser is null)
        {
            return Results.NotFound(new { error = "User not found" });
        }

        var totalXp = userXp?.TotalXp ?? 0;
        var currentLevel = userXp?.CurrentLevel ?? 1;
        var currentRank = userXp?.CurrentRank ?? "aspire-intern";
        var weeklyXp = userXp?.WeeklyXp ?? 0;

        var xpToNextLevel = GamificationService.GetXpForNextLevel(totalXp);
        var xpForCurrentLevel = GamificationService.GetCumulativeXpForLevel(currentLevel + 1);

        var recentEvents = await db.XpEvents
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.CreatedAt)
            .Take(20)
            .Select(e => new XpEventDto(e.Id, e.XpAmount, e.SourceType, e.SourceId, e.CreatedAt))
            .ToListAsync();

        return Results.Ok(new XpStatsResponse(
            TotalXp: totalXp,
            CurrentLevel: currentLevel,
            CurrentRank: currentRank,
            WeeklyXp: weeklyXp,
            XpToNextLevel: xpToNextLevel,
            XpForCurrentLevel: xpForCurrentLevel,
            LoginStreakDays: dbUser.LoginStreakDays,
            RecentEvents: recentEvents));
    }

    private static async Task<IResult> CompleteLessonAsync(
        ProgressCompleteRequest request,
        AcademyDbContext db,
        GamificationService gamification,
        ClaimsPrincipal user)
    {
        var userId = GetUserId(user);
        s_logger.LogInformation("Complete lesson request for LessonId={LessonId}, UserId={UserId}", request.LessonId, userId);

        var lesson = await db.Lessons.FindAsync(request.LessonId);
        if (lesson is null)
        {
            return Results.NotFound(new { error = "Lesson not found" });
        }

        if (lesson.Type is not "learn")
        {
            return Results.BadRequest(new { error = "Only 'learn' type lessons can be completed via this endpoint" });
        }

        // Check unlock status
        if (lesson.UnlockAfterLessonId is not null)
        {
            var prereq = await db.UserProgress
                .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lesson.UnlockAfterLessonId);

            if (prereq?.Status is not ("completed" or "perfect" or "skipped"))
            {
                return Results.Forbid();
            }
        }

        // Check existing progress
        var existing = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == request.LessonId);

        if (existing?.Status is "completed" or "perfect")
        {
            return Results.BadRequest(new { error = "Lesson already completed" });
        }

        // Create or update progress
        if (existing is null)
        {
            existing = new UserProgress
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                LessonId = request.LessonId,
                StartedAt = DateTime.UtcNow
            };
            db.UserProgress.Add(existing);
        }

        existing.Status = "completed";
        existing.CompletedAt = DateTime.UtcNow;
        existing.Attempts = 1;

        // Award XP — use execution strategy to support Npgsql retry with transactions
        var strategy = db.Database.CreateExecutionStrategy();
        var xpEarned = lesson.XpReward;
        XpAwardResult result = null!;

        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync();
            try
            {
                result = await gamification.AwardXpAsync(userId, xpEarned, "lesson-complete", request.LessonId);
                existing.XpEarned = xpEarned;
                await db.SaveChangesAsync();
                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        });

        // Check achievements (outside transaction — not critical path)
        var achievements = await gamification.CheckAchievementsAsync(userId);

        AcademyMetrics.LessonsCompleted.Add(1);
        AcademyMetrics.XpAwarded.Add(xpEarned);
        if (achievements.Count > 0)
        {
            AcademyMetrics.AchievementsUnlocked.Add(achievements.Count);
        }

        return Results.Ok(new ProgressCompleteResponse(
            XpEarned: xpEarned,
            BonusXpEarned: 0,
            TotalXp: result.TotalXp,
            CurrentLevel: result.CurrentLevel,
            LevelUp: result.LevelUp,
            AchievementsUnlocked: achievements.Select(a =>
                new AchievementUnlocked(a.Id, a.Name, a.Icon, a.Rarity, a.XpReward)).ToList()));
    }

    private static async Task<IResult> SkipLessonAsync(
        SkipRequest request,
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = GetUserId(user);
        s_logger.LogInformation("Skip lesson request for LessonId={LessonId}, UserId={UserId}", request.LessonId, userId);

        var lesson = await db.Lessons.FindAsync(request.LessonId);
        if (lesson is null)
        {
            return Results.NotFound(new { error = "Lesson not found" });
        }

        var existing = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == request.LessonId);

        if (existing?.Status is "completed" or "perfect")
        {
            return Results.BadRequest(new { error = "Cannot skip an already completed lesson" });
        }

        if (existing?.Status is "skipped")
        {
            return Results.Ok(new SkipResponse(Skipped: true, LessonId: request.LessonId));
        }

        if (existing is null)
        {
            existing = new UserProgress
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                LessonId = request.LessonId,
                StartedAt = DateTime.UtcNow
            };
            db.UserProgress.Add(existing);
        }

        existing.Status = "skipped";
        existing.XpEarned = 0;
        existing.CompletedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        return Results.Ok(new SkipResponse(Skipped: true, LessonId: request.LessonId));
    }

    private static async Task<IResult> UnskipLessonAsync(
        SkipRequest request,
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = GetUserId(user);
        s_logger.LogInformation("Unskip lesson request for LessonId={LessonId}, UserId={UserId}", request.LessonId, userId);

        var existing = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == request.LessonId);

        if (existing is null || existing.Status is not "skipped")
        {
            return Results.BadRequest(new { error = "Lesson is not skipped" });
        }

        db.UserProgress.Remove(existing);
        await db.SaveChangesAsync();

        return Results.Ok(new UnskipResponse(Unskipped: true, LessonId: request.LessonId));
    }

    private static async Task<IResult> GetAchievementsAsync(
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = GetUserId(user);

        var allAchievements = await db.Achievements
            .OrderBy(a => a.SortOrder)
            .ToListAsync();

        var userAchievements = await db.UserAchievements
            .Where(ua => ua.UserId == userId)
            .ToDictionaryAsync(ua => ua.AchievementId, ua => ua.UnlockedAt);

        var result = allAchievements.Select(a =>
        {
            var isUnlocked = userAchievements.TryGetValue(a.Id, out var unlockedAt);

            return new AchievementDto(
                Id: a.Id,
                Name: a.Name,
                Description: a.Description,
                Icon: a.Icon,
                Category: a.Category,
                Rarity: a.Rarity,
                IsUnlocked: isUnlocked,
                UnlockedAt: isUnlocked ? unlockedAt : null,
                XpReward: a.XpReward);
        }).ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> RandomizeAvatarAsync(
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = GetUserId(user);

        var dbUser = await db.Users.FindAsync(userId);
        if (dbUser is null)
        {
            return Results.NotFound(new { error = "User not found" });
        }

        dbUser.AvatarSeed = Guid.NewGuid().ToString("N");
        await db.SaveChangesAsync();

        var avatarUrl = AvatarHelper.GetAvatarUrl(dbUser.AvatarSeed, dbUser.Email);
        return Results.Ok(new AvatarRandomizeResponse(avatarUrl));
    }

    private static async Task<IResult> ClearAvatarAsync(
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = GetUserId(user);

        var dbUser = await db.Users.FindAsync(userId);
        if (dbUser is null)
        {
            return Results.NotFound(new { error = "User not found" });
        }

        dbUser.AvatarSeed = null;
        await db.SaveChangesAsync();

        var avatarUrl = AvatarHelper.GetAvatarUrl(dbUser.AvatarSeed, dbUser.Email);
        return Results.Ok(new AvatarRandomizeResponse(avatarUrl));
    }

    private static Guid GetUserId(ClaimsPrincipal user)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;

        if (idClaim is null || !Guid.TryParse(idClaim, out var userId))
        {
            throw new BadHttpRequestException("Invalid or missing user identity.", StatusCodes.Status401Unauthorized);
        }

        return userId;
    }
}
