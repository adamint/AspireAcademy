using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Telemetry;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

namespace AspireAcademy.Api.Services;

public record LevelUpInfo(int PreviousLevel, string PreviousRank, int NewLevel, string NewRank);

public record XpAwardResult(int XpAwarded, int TotalXp, int CurrentLevel, string CurrentRank, int WeeklyXp, LevelUpInfo? LevelUp);

public class GamificationService(AcademyDbContext db, IConnectionMultiplexer redis, ILogger<GamificationService> logger)
{
    /// <summary>
    /// Safely reads an int from a JsonElement that may be stored as a number or a string.
    /// Handles YAML-deserialized values where numbers become strings in JSON.
    /// </summary>
    private static int GetJsonInt(JsonElement element, string propertyName)
    {
        var prop = element.GetProperty(propertyName);
        return prop.ValueKind == JsonValueKind.Number
            ? prop.GetInt32()
            : int.Parse(prop.GetString() ?? "0");
    }
    public async Task<XpAwardResult> AwardXpAsync(Guid userId, int amount, string sourceType, string? sourceId)
    {
        using var activity = AcademyTracing.Source.StartActivity("GamificationService.AwardXp");
        activity?.SetTag("userId", userId.ToString());
        activity?.SetTag("xp.amount", amount);
        activity?.SetTag("xp.sourceType", sourceType);

        logger.LogInformation("XP awarded: +{Amount} to UserId={UserId}, source={SourceType}/{SourceId}",
            amount, userId, sourceType, sourceId);

        var userXp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId);

        if (userXp is null)
        {
            userXp = new UserXp
            {
                UserId = userId,
                TotalXp = 0,
                CurrentLevel = 1,
                CurrentRank = Ranks.AspireIntern,
                WeeklyXp = 0,
                WeekStart = GetCurrentWeekStart()
            };
            db.UserXp.Add(userXp);
            await db.SaveChangesAsync();
        }

        var previousLevel = userXp.CurrentLevel;
        var previousRank = userXp.CurrentRank;

        // Atomic increment to avoid race conditions
        await db.UserXp.Where(x => x.UserId == userId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.TotalXp, x => x.TotalXp + amount)
                .SetProperty(x => x.WeeklyXp, x => x.WeeklyXp + amount));

        // Re-read updated values
        await db.Entry(userXp).ReloadAsync();

        var (newLevel, newRank) = CalculateLevel(userXp.TotalXp);
        userXp.CurrentLevel = newLevel;
        userXp.CurrentRank = newRank;

        db.XpEvents.Add(new XpEvent
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            XpAmount = amount,
            SourceType = sourceType,
            SourceId = sourceId,
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        // Update Redis leaderboards
        var redisDb = redis.GetDatabase();
        await redisDb.SortedSetIncrementAsync("leaderboard:weekly", userId.ToString(), amount);
        await redisDb.SortedSetAddAsync("leaderboard:alltime", userId.ToString(), userXp.TotalXp);

        LevelUpInfo? levelUp = null;
        if (newLevel > previousLevel)
        {
            levelUp = new LevelUpInfo(previousLevel, previousRank, newLevel, newRank);
            logger.LogInformation("Level up! {OldLevel} ({OldRank}) → {NewLevel} ({NewRank}) for UserId={UserId}",
                previousLevel, previousRank, newLevel, newRank, userId);
        }

        return new XpAwardResult(amount, userXp.TotalXp, newLevel, newRank, userXp.WeeklyXp, levelUp);
    }

    public static (int Level, string Rank) CalculateLevel(int totalXp)
    {
        var level = 1;
        var xpNeeded = 0;

        for (var l = 2; l <= 42; l++)
        {
            xpNeeded += l * 100;
            if (totalXp < xpNeeded)
            {
                break;
            }

            level = l;
        }

        var rank = level switch
        {
            <= 5 => Ranks.AspireIntern,
            <= 12 => Ranks.AspireDeveloper,
            <= 17 => Ranks.AspireEngineer,
            <= 28 => Ranks.AspireSpecialist,
            <= 36 => Ranks.AspireExpert,
            <= 41 => Ranks.AspireMaster,
            42 => Ranks.AspireArchitect,
            _ => Ranks.AspireIntern
        };

        return (level, rank);
    }

    public static int GetXpForNextLevel(int totalXp)
    {
        var xpNeeded = 0;

        for (var l = 2; l <= 42; l++)
        {
            xpNeeded += l * 100;
            if (totalXp < xpNeeded)
            {
                return xpNeeded - totalXp;
            }
        }

        return 0; // Max level
    }

    public static int GetCumulativeXpForLevel(int level)
    {
        var cumulative = 0;

        for (var l = 2; l <= level; l++)
        {
            cumulative += l * 100;
        }

        return cumulative;
    }

    public async Task<List<Achievement>> CheckAchievementsAsync(Guid userId)
    {
        using var activity = AcademyTracing.Source.StartActivity("GamificationService.CheckAchievements");
        activity?.SetTag("userId", userId.ToString());

        var unlockedIds = await db.UserAchievements
            .Where(ua => ua.UserId == userId)
            .Select(ua => ua.AchievementId)
            .ToListAsync();

        var lockedAchievements = await db.Achievements
            .Where(a => !unlockedIds.Contains(a.Id))
            .ToListAsync();

        logger.LogInformation("Checking {Count} locked achievements for UserId={UserId}", lockedAchievements.Count, userId);

        var newlyUnlocked = new List<Achievement>();

        foreach (var achievement in lockedAchievements)
        {
            var triggered = achievement.TriggerType switch
            {
                "lesson-complete" => await CheckLessonCountAsync(userId, achievement.TriggerConfig),
                "quiz-pass" => await CheckQuizPassCountAsync(userId, achievement.TriggerConfig),
                "challenge-pass-tag" => await CheckChallengeTagAsync(userId, achievement.TriggerConfig),
                "module-complete" => await CheckModuleCompleteAsync(userId, achievement.TriggerConfig),
                "modules-complete" => await CheckMultipleModulesCompleteAsync(userId, achievement.TriggerConfig),
                "world-complete" => await CheckWorldCompleteAsync(userId, achievement.TriggerConfig),
                "world-complete-any" => await CheckAnyWorldCompleteAsync(userId),
                "all-worlds-complete" => await CheckAllWorldsCompleteAsync(userId),
                "streak" => await CheckStreakAsync(userId, achievement.TriggerConfig),
                "lessons-in-day" => await CheckLessonsTodayAsync(userId, achievement.TriggerConfig),
                "perfect-quizzes" => await CheckPerfectQuizCountAsync(userId, achievement.TriggerConfig),
                "first-try-challenges" => await CheckFirstTryChallengeCountAsync(userId, achievement.TriggerConfig),
                "boss-complete-all" => await CheckAllBossesCompleteAsync(userId),
                "build-projects-all" => await CheckAllBuildProjectsCompleteAsync(userId),
                _ => false
            };

            if (triggered)
            {
                logger.LogInformation("Achievement triggered: {AchievementId} ({AchievementName}) for UserId={UserId}",
                    achievement.Id, achievement.Name, userId);

                newlyUnlocked.Add(achievement);

                db.UserAchievements.Add(new UserAchievement
                {
                    UserId = userId,
                    AchievementId = achievement.Id,
                    UnlockedAt = DateTime.UtcNow
                });

                if (achievement.XpReward > 0)
                {
                    await AwardXpAsync(userId, achievement.XpReward, "achievement-bonus", achievement.Id);
                }
            }
        }

        await db.SaveChangesAsync();
        return newlyUnlocked;
    }

    public async Task UpdateStreakAsync(Guid userId)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return;
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (user.LastStreakDate == today)
        {
            return; // Already counted today
        }

        if (user.LastStreakDate is not null && today.DayNumber - user.LastStreakDate.Value.DayNumber == 1)
        {
            user.LoginStreakDays++;
        }
        else if (user.LastStreakDate is null || today.DayNumber - user.LastStreakDate.Value.DayNumber > 1)
        {
            user.LoginStreakDays = 1;
        }

        user.LastStreakDate = today;

        // Check streak milestones for bonus XP (one-time awards)
        var streakBonuses = new Dictionary<int, int> { [7] = 200, [14] = 500, [30] = 1000 };

        if (streakBonuses.TryGetValue(user.LoginStreakDays, out var bonusXp))
        {
            var alreadyAwarded = await db.XpEvents.AnyAsync(e =>
                e.UserId == userId &&
                e.SourceType == "streak-bonus" &&
                e.SourceId == $"streak-{user.LoginStreakDays}");

            if (!alreadyAwarded)
            {
                await AwardXpAsync(userId, bonusXp, "streak-bonus", $"streak-{user.LoginStreakDays}");
            }
        }

        await db.SaveChangesAsync();
    }

    // ── Achievement check helpers ──

    private async Task<bool> CheckLessonCountAsync(Guid userId, JsonDocument config)
    {
        var count = GetJsonInt(config.RootElement, "count");

        var completed = await db.UserProgress
            .CountAsync(p => p.UserId == userId && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect));

        return completed >= count;
    }

    private async Task<bool> CheckQuizPassCountAsync(Guid userId, JsonDocument config)
    {
        var count = GetJsonInt(config.RootElement, "count");

        var passed = await db.UserProgress
            .CountAsync(p => p.UserId == userId
                && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect)
                && p.Lesson.Type == LessonTypes.Quiz);

        return passed >= count;
    }

    private async Task<bool> CheckChallengeTagAsync(Guid userId, JsonDocument config)
    {
        var count = GetJsonInt(config.RootElement, "count");

        // Count completed challenges
        var completed = await db.UserProgress
            .CountAsync(p => p.UserId == userId
                && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect)
                && p.Lesson.Type == LessonTypes.Challenge);

        return completed >= count;
    }

    private async Task<bool> CheckModuleCompleteAsync(Guid userId, JsonDocument config)
    {
        var moduleId = config.RootElement.GetProperty("moduleId").GetString()!;
        return await IsModuleCompleteAsync(userId, moduleId);
    }

    private async Task<bool> CheckMultipleModulesCompleteAsync(Guid userId, JsonDocument config)
    {
        var moduleIds = config.RootElement.GetProperty("moduleIds")
            .EnumerateArray()
            .Select(e => e.GetString()!)
            .ToList();

        foreach (var moduleId in moduleIds)
        {
            if (!await IsModuleCompleteAsync(userId, moduleId))
            {
                return false;
            }
        }

        return true;
    }

    private async Task<bool> CheckWorldCompleteAsync(Guid userId, JsonDocument config)
    {
        var worldId = config.RootElement.GetProperty("worldId").GetString()!;
        return await IsWorldCompleteAsync(userId, worldId);
    }

    private async Task<bool> CheckAnyWorldCompleteAsync(Guid userId)
    {
        var worldIds = await db.Worlds.Select(w => w.Id).ToListAsync();

        foreach (var worldId in worldIds)
        {
            if (await IsWorldCompleteAsync(userId, worldId))
            {
                return true;
            }
        }

        return false;
    }

    private async Task<bool> CheckAllWorldsCompleteAsync(Guid userId)
    {
        var worldIds = await db.Worlds.Select(w => w.Id).ToListAsync();

        foreach (var worldId in worldIds)
        {
            if (!await IsWorldCompleteAsync(userId, worldId))
            {
                return false;
            }
        }

        return true;
    }

    private async Task<bool> CheckStreakAsync(Guid userId, JsonDocument config)
    {
        var days = GetJsonInt(config.RootElement, "days");
        var user = await db.Users.FindAsync(userId);

        return user is not null && user.LoginStreakDays >= days;
    }

    private async Task<bool> CheckLessonsTodayAsync(Guid userId, JsonDocument config)
    {
        var count = GetJsonInt(config.RootElement, "count");
        var todayStart = DateTime.UtcNow.Date;

        var completedToday = await db.UserProgress
            .CountAsync(p => p.UserId == userId
                && p.CompletedAt >= todayStart
                && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect));

        return completedToday >= count;
    }

    private async Task<bool> CheckPerfectQuizCountAsync(Guid userId, JsonDocument config)
    {
        var count = GetJsonInt(config.RootElement, "count");

        var perfects = await db.UserProgress
            .CountAsync(p => p.UserId == userId
                && p.Status == ProgressStatuses.Perfect
                && p.Lesson.Type == LessonTypes.Quiz);

        return perfects >= count;
    }

    private async Task<bool> CheckFirstTryChallengeCountAsync(Guid userId, JsonDocument config)
    {
        var count = GetJsonInt(config.RootElement, "count");

        var firstTryPasses = await db.UserProgress
            .CountAsync(p => p.UserId == userId
                && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect)
                && p.Attempts == 1
                && (p.Lesson.Type == LessonTypes.Challenge || p.Lesson.Type == LessonTypes.BuildProject));

        return firstTryPasses >= count;
    }

    private async Task<bool> CheckAllBossesCompleteAsync(Guid userId)
    {
        var bossLessonIds = await db.Lessons
            .Where(l => l.IsBoss)
            .Select(l => l.Id)
            .ToListAsync();

        if (bossLessonIds.Count == 0)
        {
            return false;
        }

        var completedBossCount = await db.UserProgress
            .CountAsync(p => p.UserId == userId
                && bossLessonIds.Contains(p.LessonId)
                && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect));

        return completedBossCount >= bossLessonIds.Count;
    }

    private async Task<bool> CheckAllBuildProjectsCompleteAsync(Guid userId)
    {
        var buildLessonIds = await db.Lessons
            .Where(l => l.Type == LessonTypes.BuildProject)
            .Select(l => l.Id)
            .ToListAsync();

        if (buildLessonIds.Count == 0)
        {
            return false;
        }

        var completedCount = await db.UserProgress
            .CountAsync(p => p.UserId == userId
                && buildLessonIds.Contains(p.LessonId)
                && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect));

        return completedCount >= buildLessonIds.Count;
    }

    private async Task<bool> IsModuleCompleteAsync(Guid userId, string moduleId)
    {
        var lessonIds = await db.Lessons
            .Where(l => l.ModuleId == moduleId)
            .Select(l => l.Id)
            .ToListAsync();

        if (lessonIds.Count == 0)
        {
            return false;
        }

        var completedCount = await db.UserProgress
            .CountAsync(p => p.UserId == userId
                && lessonIds.Contains(p.LessonId)
                && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect));

        return completedCount >= lessonIds.Count;
    }

    private async Task<bool> IsWorldCompleteAsync(Guid userId, string worldId)
    {
        var moduleIds = await db.Modules
            .Where(m => m.WorldId == worldId)
            .Select(m => m.Id)
            .ToListAsync();

        foreach (var moduleId in moduleIds)
        {
            if (!await IsModuleCompleteAsync(userId, moduleId))
            {
                return false;
            }
        }

        return true;
    }

    private static DateOnly GetCurrentWeekStart()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var daysFromMonday = ((int)today.DayOfWeek + 6) % 7;
        return today.AddDays(-daysFromMonday);
    }
}
