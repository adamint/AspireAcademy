using System.Security.Claims;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
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

public record AvatarItemDto(string Id, string Name, int? UnlockLevel = null, string? UnlockAchievement = null, string? UnlockRank = null, bool IsUnlocked = false);

public record AvatarResponse(
    string Base,
    List<string> Accessories,
    string Background,
    string Frame,
    List<string> AvailableBases,
    List<AvatarItemDto> AvailableAccessories,
    List<AvatarItemDto> AvailableBackgrounds,
    List<AvatarItemDto> AvailableFrames);

public record AvatarUpdateRequest(string Base, List<string> Accessories, string Background, string Frame);

public static class GamificationEndpoints
{
    private static ILogger s_logger = null!;

    // ── Static avatar data ──

    private static readonly List<string> s_allBases = ["developer", "architect", "devops", "data-engineer"];

    private static readonly List<(string Id, string Name, int UnlockLevel)> s_accessories =
    [
        ("hard-hat", "Hard Hat", 6),
        ("cloud-cape", "Cloud Cape", 13),
        ("container-hat", "Container Hat", 18),
        ("telescope", "Telescope", 29),
        ("golden-wrench", "Golden Wrench", 37),
        ("crown", "Crown", 42)
    ];

    private static readonly List<(string Id, string Name, string? UnlockAchievement)> s_backgrounds =
    [
        ("default", "Default Gray", null),
        ("server-room", "Server Room", "first-resource"),
        ("cloud-sky", "Cloud Sky", "container-captain"),
        ("dashboard", "Dashboard View", "observability-guru"),
        ("code-matrix", "Code Matrix", "hundred-lessons"),
        ("golden-hall", "Golden Hall", "aspire-architect")
    ];

    private static readonly List<(string Id, string Name, int? UnlockLevel, string? UnlockRank)> s_frames =
    [
        ("none", "No Frame", null, null),
        ("bronze", "Bronze Frame", 10, null),
        ("silver", "Silver Frame", 20, null),
        ("gold", "Gold Frame", 30, null),
        ("diamond", "Diamond Frame", 40, null),
        ("golden", "Golden Frame", null, "aspire-architect")
    ];

    public static WebApplication MapGamificationEndpoints(this WebApplication app)
    {
        s_logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("GamificationEndpoints");

        var group = app.MapGroup("/api").RequireAuthorization();

        group.MapGet("/xp", GetXpStatsAsync);
        group.MapPost("/progress/complete", CompleteLessonAsync);
        group.MapGet("/achievements", GetAchievementsAsync);
        group.MapGet("/avatar", GetAvatarAsync);
        group.MapPut("/avatar", UpdateAvatarAsync);

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

            if (prereq?.Status is not ("completed" or "perfect"))
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

        // Wrap XP award + progress creation in a transaction to prevent duplicate XP
        await using var transaction = await db.Database.BeginTransactionAsync();

        try
        {
            // Award XP
            var xpEarned = lesson.XpReward;
            var result = await gamification.AwardXpAsync(userId, xpEarned, "lesson-complete", request.LessonId);
            existing.XpEarned = xpEarned;

            await db.SaveChangesAsync();
            await transaction.CommitAsync();

            // Check achievements
            var achievements = await gamification.CheckAchievementsAsync(userId);

            return Results.Ok(new ProgressCompleteResponse(
                XpEarned: xpEarned,
                BonusXpEarned: 0,
                TotalXp: result.TotalXp,
                CurrentLevel: result.CurrentLevel,
                LevelUp: result.LevelUp,
                AchievementsUnlocked: achievements.Select(a =>
                    new AchievementUnlocked(a.Id, a.Name, a.Icon, a.Rarity, a.XpReward)).ToList()));
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
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

    private static async Task<IResult> GetAvatarAsync(
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = GetUserId(user);

        var dbUser = await db.Users.FindAsync(userId);
        if (dbUser is null)
        {
            return Results.NotFound(new { error = "User not found" });
        }

        var userXp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId);
        var level = userXp?.CurrentLevel ?? 1;
        var rank = userXp?.CurrentRank ?? "aspire-intern";

        var unlockedAchievementIds = await db.UserAchievements
            .Where(ua => ua.UserId == userId)
            .Select(ua => ua.AchievementId)
            .ToListAsync();

        var availableAccessories = s_accessories.Select(a =>
            new AvatarItemDto(a.Id, a.Name, UnlockLevel: a.UnlockLevel, IsUnlocked: level >= a.UnlockLevel))
            .ToList();

        var availableBackgrounds = s_backgrounds.Select(b =>
            new AvatarItemDto(b.Id, b.Name, UnlockAchievement: b.UnlockAchievement,
                IsUnlocked: b.UnlockAchievement is null || unlockedAchievementIds.Contains(b.UnlockAchievement)))
            .ToList();

        var availableFrames = s_frames.Select(f =>
        {
            var isUnlocked = f.UnlockLevel is null && f.UnlockRank is null
                || (f.UnlockLevel is not null && level >= f.UnlockLevel)
                || (f.UnlockRank is not null && rank == f.UnlockRank);

            return new AvatarItemDto(f.Id, f.Name, UnlockLevel: f.UnlockLevel, UnlockRank: f.UnlockRank, IsUnlocked: isUnlocked);
        }).ToList();

        return Results.Ok(new AvatarResponse(
            Base: dbUser.AvatarBase,
            Accessories: dbUser.AvatarAccessories,
            Background: dbUser.AvatarBackground,
            Frame: dbUser.AvatarFrame,
            AvailableBases: s_allBases,
            AvailableAccessories: availableAccessories,
            AvailableBackgrounds: availableBackgrounds,
            AvailableFrames: availableFrames));
    }

    private static async Task<IResult> UpdateAvatarAsync(
        AvatarUpdateRequest request,
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = GetUserId(user);

        var dbUser = await db.Users.FindAsync(userId);
        if (dbUser is null)
        {
            return Results.NotFound(new { error = "User not found" });
        }

        var userXp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId);
        var level = userXp?.CurrentLevel ?? 1;
        var rank = userXp?.CurrentRank ?? "aspire-intern";

        var unlockedAchievementIds = await db.UserAchievements
            .Where(ua => ua.UserId == userId)
            .Select(ua => ua.AchievementId)
            .ToListAsync();

        // Validate base
        if (!s_allBases.Contains(request.Base))
        {
            return Results.BadRequest(new { error = $"Invalid base: {request.Base}" });
        }

        // Validate accessories
        if (request.Accessories is not null)
        {
            foreach (var accessoryId in request.Accessories)
        {
            var accessory = s_accessories.FirstOrDefault(a => a.Id == accessoryId);

            if (accessory == default)
            {
                return Results.BadRequest(new { error = $"Invalid accessory: {accessoryId}" });
            }

            if (level < accessory.UnlockLevel)
            {
                return Results.BadRequest(new { error = $"Accessory '{accessoryId}' requires level {accessory.UnlockLevel}" });
            }
            }
        }

        // Validate background
        var bg = s_backgrounds.FirstOrDefault(b => b.Id == request.Background);
        if (bg == default)
        {
            return Results.BadRequest(new { error = $"Invalid background: {request.Background}" });
        }

        if (bg.UnlockAchievement is not null && !unlockedAchievementIds.Contains(bg.UnlockAchievement))
        {
            return Results.BadRequest(new { error = $"Background '{request.Background}' requires achievement '{bg.UnlockAchievement}'" });
        }

        // Validate frame
        var frame = s_frames.FirstOrDefault(f => f.Id == request.Frame);
        if (frame == default)
        {
            return Results.BadRequest(new { error = $"Invalid frame: {request.Frame}" });
        }

        var frameUnlocked = frame.UnlockLevel is null && frame.UnlockRank is null
            || (frame.UnlockLevel is not null && level >= frame.UnlockLevel)
            || (frame.UnlockRank is not null && rank == frame.UnlockRank);

        if (!frameUnlocked)
        {
            return Results.BadRequest(new { error = $"Frame '{request.Frame}' is not unlocked" });
        }

        // Apply updates
        dbUser.AvatarBase = request.Base;
        dbUser.AvatarAccessories = request.Accessories ?? [];
        dbUser.AvatarBackground = request.Background;
        dbUser.AvatarFrame = request.Frame;

        await db.SaveChangesAsync();

        // Build response (same shape as GET)
        var availableAccessories = s_accessories.Select(a =>
            new AvatarItemDto(a.Id, a.Name, UnlockLevel: a.UnlockLevel, IsUnlocked: level >= a.UnlockLevel))
            .ToList();

        var availableBackgrounds = s_backgrounds.Select(b =>
            new AvatarItemDto(b.Id, b.Name, UnlockAchievement: b.UnlockAchievement,
                IsUnlocked: b.UnlockAchievement is null || unlockedAchievementIds.Contains(b.UnlockAchievement)))
            .ToList();

        var availableFrames = s_frames.Select(f =>
        {
            var isUnlocked = f.UnlockLevel is null && f.UnlockRank is null
                || (f.UnlockLevel is not null && level >= f.UnlockLevel)
                || (f.UnlockRank is not null && rank == f.UnlockRank);

            return new AvatarItemDto(f.Id, f.Name, UnlockLevel: f.UnlockLevel, UnlockRank: f.UnlockRank, IsUnlocked: isUnlocked);
        }).ToList();

        return Results.Ok(new AvatarResponse(
            Base: dbUser.AvatarBase,
            Accessories: dbUser.AvatarAccessories,
            Background: dbUser.AvatarBackground,
            Frame: dbUser.AvatarFrame,
            AvailableBases: s_allBases,
            AvailableAccessories: availableAccessories,
            AvailableBackgrounds: availableBackgrounds,
            AvailableFrames: availableFrames));
    }

    private static Guid GetUserId(ClaimsPrincipal user)
    {
        var idClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;

        return Guid.Parse(idClaim!);
    }
}
