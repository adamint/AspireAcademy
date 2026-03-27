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
    List<XpEventDto> RecentEvents,
    NextLessonDto? NextLesson);

public record XpEventDto(Guid Id, string Type, string Description, int XpEarned, DateTime CreatedAt);

public record NextLessonDto(string Id, string Title, string ModuleName, string WorldId, string Type);

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

public record DailyRewardResponse(bool Awarded, int XpAwarded, int StreakDays, bool AlreadyClaimed);

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
        group.MapPost("/daily-reward", ClaimDailyRewardAsync);

        return app;
    }

    private static async Task<IResult> GetXpStatsAsync(
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);

        var userXp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId);
        var dbUser = await db.Users.FindAsync(userId);

        if (dbUser is null)
        {
            return Results.NotFound(new ErrorResponse("User not found"));
        }

        var totalXp = userXp?.TotalXp ?? 0;
        var currentLevel = userXp?.CurrentLevel ?? 1;
        var currentRank = userXp?.CurrentRank ?? Ranks.AspireIntern;
        var weeklyXp = userXp?.WeeklyXp ?? 0;

        var xpToNextLevel = GamificationService.GetXpForNextLevel(totalXp);
        var xpForCurrentLevel = GamificationService.GetCumulativeXpForLevel(currentLevel + 1);

        var rawEvents = await db.XpEvents
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.CreatedAt)
            .Take(20)
            .ToListAsync();

        // Gather source IDs to look up lesson titles and achievement names
        var lessonSourceTypes = new HashSet<string> { "lesson-complete", "challenge-first-try", "quiz-perfect" };
        var lessonIds = rawEvents
            .Where(e => lessonSourceTypes.Contains(e.SourceType) && e.SourceId is not null)
            .Select(e => e.SourceId!)
            .Distinct()
            .ToList();

        var achievementIds = rawEvents
            .Where(e => e.SourceType == "achievement-bonus" && e.SourceId is not null)
            .Select(e => e.SourceId!)
            .Distinct()
            .ToList();

        var lessonLookup = lessonIds.Count > 0
            ? await db.Lessons
                .Where(l => lessonIds.Contains(l.Id))
                .Select(l => new { l.Id, l.Title, l.Type })
                .ToDictionaryAsync(l => l.Id)
            : [];

        var achievementLookup = achievementIds.Count > 0
            ? await db.Achievements
                .Where(a => achievementIds.Contains(a.Id))
                .Select(a => new { a.Id, a.Name, a.Icon })
                .ToDictionaryAsync(a => a.Id)
            : [];

        var recentEvents = rawEvents.Select(e =>
        {
            var (type, description) = e.SourceType switch
            {
                "lesson-complete" when e.SourceId is not null && lessonLookup.TryGetValue(e.SourceId, out var lesson) =>
                    lesson.Type switch
                    {
                        LessonTypes.Quiz => ("quiz", $"Passed quiz: {lesson.Title}"),
                        LessonTypes.Challenge or LessonTypes.BuildProject => ("challenge", $"Completed challenge: {lesson.Title}"),
                        LessonTypes.BossBattle => ("challenge", $"Defeated boss: {lesson.Title}"),
                        _ => ("lesson", $"Completed lesson: {lesson.Title}")
                    },
                "challenge-first-try" when e.SourceId is not null && lessonLookup.TryGetValue(e.SourceId, out var cl) =>
                    ("challenge", $"First try bonus: {cl.Title}"),
                "quiz-perfect" when e.SourceId is not null && lessonLookup.TryGetValue(e.SourceId, out var ql) =>
                    ("quiz", $"Perfect score: {ql.Title}"),
                "achievement-bonus" when e.SourceId is not null && achievementLookup.TryGetValue(e.SourceId, out var ach) =>
                    ("achievement", $"Unlocked achievement: {ach.Name} {ach.Icon}"),
                "streak-bonus" => ("streak", $"Streak bonus: {e.SourceId?.Replace("streak-", "")} days 🔥"),
                _ => ("bonus", $"Earned bonus XP")
            };

            return new XpEventDto(e.Id, type, description, e.XpAmount, e.CreatedAt);
        }).ToList();

        // Find next lesson for "Continue Learning"
        NextLessonDto? nextLesson = null;
        var completedLessonIds = await db.UserProgress
            .Where(p => p.UserId == userId && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect || p.Status == ProgressStatuses.Skipped))
            .Select(p => p.LessonId)
            .ToListAsync();

        var nextLessonEntity = await db.Lessons
            .Include(l => l.Module)
            .Where(l => !completedLessonIds.Contains(l.Id))
            .OrderBy(l => l.Module.SortOrder)
            .ThenBy(l => l.SortOrder)
            .FirstOrDefaultAsync();

        if (nextLessonEntity is not null)
        {
            nextLesson = new NextLessonDto(
                nextLessonEntity.Id,
                nextLessonEntity.Title,
                nextLessonEntity.Module.Name,
                nextLessonEntity.Module.WorldId,
                nextLessonEntity.Type);
        }

        return Results.Ok(new XpStatsResponse(
            TotalXp: totalXp,
            CurrentLevel: currentLevel,
            CurrentRank: currentRank,
            WeeklyXp: weeklyXp,
            XpToNextLevel: xpToNextLevel,
            XpForCurrentLevel: xpForCurrentLevel,
            LoginStreakDays: dbUser.LoginStreakDays,
            RecentEvents: recentEvents,
            NextLesson: nextLesson));
    }

    private static async Task<IResult> CompleteLessonAsync(
        ProgressCompleteRequest request,
        AcademyDbContext db,
        GamificationService gamification,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);
        s_logger.LogInformation("Complete lesson request for LessonId={LessonId}, UserId={UserId}", request.LessonId, userId);

        var lesson = await db.Lessons.FindAsync(request.LessonId);
        if (lesson is null)
        {
            return Results.NotFound(new ErrorResponse("Lesson not found"));
        }

        if (lesson.Type is not LessonTypes.Learn)
        {
            return Results.BadRequest(new ErrorResponse("Only 'learn' type lessons can be completed via this endpoint"));
        }

        // Check unlock status
        if (lesson.UnlockAfterLessonId is not null)
        {
            var prereq = await db.UserProgress
                .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lesson.UnlockAfterLessonId);

            if (prereq?.Status is not (ProgressStatuses.Completed or ProgressStatuses.Perfect or ProgressStatuses.Skipped))
            {
                return Results.Forbid();
            }
        }

        // Check existing progress
        var existing = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == request.LessonId);

        if (existing?.Status is ProgressStatuses.Completed or ProgressStatuses.Perfect)
        {
            return Results.BadRequest(new ErrorResponse("Lesson already completed"));
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

        existing.Status = ProgressStatuses.Completed;
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
        var userId = EndpointHelpers.GetUserId(user);
        s_logger.LogInformation("Skip lesson request for LessonId={LessonId}, UserId={UserId}", request.LessonId, userId);

        var lesson = await db.Lessons.FindAsync(request.LessonId);
        if (lesson is null)
        {
            return Results.NotFound(new ErrorResponse("Lesson not found"));
        }

        var existing = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == request.LessonId);

        if (existing?.Status is ProgressStatuses.Completed or ProgressStatuses.Perfect)
        {
            return Results.BadRequest(new ErrorResponse("Cannot skip an already completed lesson"));
        }

        if (existing?.Status is ProgressStatuses.Skipped)
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

        existing.Status = ProgressStatuses.Skipped;
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
        var userId = EndpointHelpers.GetUserId(user);
        s_logger.LogInformation("Unskip lesson request for LessonId={LessonId}, UserId={UserId}", request.LessonId, userId);

        var existing = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == request.LessonId);

        if (existing is null || existing.Status is not ProgressStatuses.Skipped)
        {
            return Results.BadRequest(new ErrorResponse("Lesson is not skipped"));
        }

        db.UserProgress.Remove(existing);
        await db.SaveChangesAsync();

        return Results.Ok(new UnskipResponse(Unskipped: true, LessonId: request.LessonId));
    }

    private static async Task<IResult> GetAchievementsAsync(
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);

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
        var userId = EndpointHelpers.GetUserId(user);

        var dbUser = await db.Users.FindAsync(userId);
        if (dbUser is null)
        {
            return Results.NotFound(new ErrorResponse("User not found"));
        }

        dbUser.AvatarSeed = Guid.NewGuid().ToString("N");
        await db.SaveChangesAsync();

        var avatarUrl = AvatarHelper.GetAvatarUrl(dbUser.AvatarSeed, dbUser.Email, dbUser.GitHubUsername);
        return Results.Ok(new AvatarRandomizeResponse(avatarUrl));
    }

    private static async Task<IResult> ClearAvatarAsync(
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);

        var dbUser = await db.Users.FindAsync(userId);
        if (dbUser is null)
        {
            return Results.NotFound(new ErrorResponse("User not found"));
        }

        dbUser.AvatarSeed = null;
        await db.SaveChangesAsync();

        var avatarUrl = AvatarHelper.GetAvatarUrl(dbUser.AvatarSeed, dbUser.Email, dbUser.GitHubUsername);
        return Results.Ok(new AvatarRandomizeResponse(avatarUrl));
    }

    private static async Task<IResult> ClaimDailyRewardAsync(
        AcademyDbContext db,
        GamificationService gamification,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);
        var dbUser = await db.Users.FindAsync(userId);

        if (dbUser is null)
        {
            return Results.NotFound(new ErrorResponse("User not found"));
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Check if already claimed today
        if (dbUser.LastStreakDate == today)
        {
            return Results.Ok(new DailyRewardResponse(
                Awarded: false,
                XpAwarded: 0,
                StreakDays: dbUser.LoginStreakDays,
                AlreadyClaimed: true));
        }

        // Update streak
        await gamification.UpdateStreakAsync(userId);

        // Re-read user to get updated streak
        await db.Entry(dbUser).ReloadAsync();

        // Calculate daily XP bonus: 10 XP × streak day, capped at 100 XP
        var streakDay = dbUser.LoginStreakDays;
        var dailyXp = Math.Min(streakDay * 10, 100);

        // Award the daily login XP
        var alreadyAwarded = await db.XpEvents.AnyAsync(e =>
            e.UserId == userId &&
            e.SourceType == "daily-login" &&
            e.CreatedAt >= DateTime.UtcNow.Date);

        if (!alreadyAwarded && dailyXp > 0)
        {
            await gamification.AwardXpAsync(userId, dailyXp, "daily-login", $"day-{streakDay}");
        }

        s_logger.LogInformation("Daily reward claimed: +{Xp} XP for UserId={UserId}, streak={Streak}",
            dailyXp, userId, streakDay);

        return Results.Ok(new DailyRewardResponse(
            Awarded: true,
            XpAwarded: dailyXp,
            StreakDays: streakDay,
            AlreadyClaimed: false));
    }

}
