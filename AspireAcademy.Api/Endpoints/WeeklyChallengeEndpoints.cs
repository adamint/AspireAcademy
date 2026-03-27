using System.Globalization;
using System.Security.Claims;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

// ── Response DTOs ──

public record WeeklyChallengeResponse(
    string LessonId,
    string Title,
    string Description,
    int WeekNumber,
    DateTime WeekStart,
    DateTime WeekEnd,
    bool UserCompleted,
    DateTime? UserCompletedAt);

public record WeeklyLeaderboardEntry(
    int Rank,
    Guid UserId,
    string Username,
    string DisplayName,
    string AvatarUrl,
    DateTime CompletedAt);

public record WeeklyLeaderboardResponse(
    List<WeeklyLeaderboardEntry> Entries,
    int TotalCompleters);

public record PreviousWeeklyChallenge(
    string LessonId,
    string Title,
    int WeekNumber,
    DateTime WeekStart,
    DateTime WeekEnd,
    bool UserCompleted);

public static class WeeklyChallengeEndpoints
{
    public static WebApplication MapWeeklyChallengeEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/weekly-challenge").RequireAuthorization();

        group.MapGet("/", GetCurrentWeeklyChallenge);
        group.MapGet("/leaderboard", GetWeeklyLeaderboard);
        group.MapGet("/previous", GetPreviousWeeklyChallenges);

        return app;
    }

    /// <summary>
    /// Returns the current week's challenge, selected deterministically from challenge-type lessons.
    /// </summary>
    private static async Task<IResult> GetCurrentWeeklyChallenge(
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);
        var (weekNumber, weekStart, weekEnd) = GetCurrentWeekInfo();

        var challengeLessons = await db.Lessons
            .Where(l => l.Type == LessonTypes.Challenge || l.Type == LessonTypes.BossBattle)
            .OrderBy(l => l.Id)
            .ToListAsync();

        if (challengeLessons.Count == 0)
        {
            return Results.NotFound(new ErrorResponse("No challenge lessons available"));
        }

        var selectedIndex = weekNumber % challengeLessons.Count;
        var lesson = challengeLessons[selectedIndex];

        // Check if user completed it this week
        var userCompletion = await db.UserProgress
            .Where(p => p.UserId == userId
                && p.LessonId == lesson.Id
                && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect)
                && p.CompletedAt >= weekStart && p.CompletedAt < weekEnd)
            .FirstOrDefaultAsync();

        return Results.Ok(new WeeklyChallengeResponse(
            lesson.Id,
            lesson.Title,
            lesson.Description,
            weekNumber,
            weekStart,
            weekEnd,
            userCompletion is not null,
            userCompletion?.CompletedAt));
    }

    /// <summary>
    /// Returns the top 10 users who completed this week's challenge, ranked by earliest completion.
    /// </summary>
    private static async Task<IResult> GetWeeklyLeaderboard(
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        EndpointHelpers.GetUserId(user); // Ensure authenticated
        var (weekNumber, weekStart, weekEnd) = GetCurrentWeekInfo();

        var challengeLessons = await db.Lessons
            .Where(l => l.Type == LessonTypes.Challenge || l.Type == LessonTypes.BossBattle)
            .OrderBy(l => l.Id)
            .ToListAsync();

        if (challengeLessons.Count == 0)
        {
            return Results.Ok(new WeeklyLeaderboardResponse([], 0));
        }

        var selectedIndex = weekNumber % challengeLessons.Count;
        var lesson = challengeLessons[selectedIndex];

        // Find all users who completed this lesson during the current week
        var completions = await db.UserProgress
            .Where(p => p.LessonId == lesson.Id
                && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect)
                && p.CompletedAt >= weekStart && p.CompletedAt < weekEnd)
            .OrderBy(p => p.CompletedAt)
            .Take(10)
            .Join(db.Users, p => p.UserId, u => u.Id, (p, u) => new { p, u })
            .ToListAsync();

        var totalCompleters = await db.UserProgress
            .CountAsync(p => p.LessonId == lesson.Id
                && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect)
                && p.CompletedAt >= weekStart && p.CompletedAt < weekEnd);

        var entries = completions.Select((c, i) => new WeeklyLeaderboardEntry(
            i + 1,
            c.u.Id,
            c.u.Username,
            c.u.DisplayName,
            AvatarHelper.GetAvatarUrl(c.u.AvatarSeed, c.u.Email, c.u.GitHubUsername),
            c.p.CompletedAt!.Value
        )).ToList();

        return Results.Ok(new WeeklyLeaderboardResponse(entries, totalCompleters));
    }

    /// <summary>
    /// Returns the previous 3 weekly challenges and whether the user completed them.
    /// </summary>
    private static async Task<IResult> GetPreviousWeeklyChallenges(
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);

        var challengeLessons = await db.Lessons
            .Where(l => l.Type == LessonTypes.Challenge || l.Type == LessonTypes.BossBattle)
            .OrderBy(l => l.Id)
            .ToListAsync();

        if (challengeLessons.Count == 0)
        {
            return Results.Ok(Array.Empty<PreviousWeeklyChallenge>());
        }

        var (currentWeek, _, _) = GetCurrentWeekInfo();
        var previous = new List<PreviousWeeklyChallenge>();

        for (var i = 1; i <= 3; i++)
        {
            var pastWeek = currentWeek - i;
            if (pastWeek < 0)
            {
                break;
            }

            var (_, pastStart, pastEnd) = GetWeekInfo(pastWeek);
            var selectedIndex = pastWeek % challengeLessons.Count;
            var lesson = challengeLessons[selectedIndex];

            var completed = await db.UserProgress
                .AnyAsync(p => p.UserId == userId
                    && p.LessonId == lesson.Id
                    && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect)
                    && p.CompletedAt >= pastStart && p.CompletedAt < pastEnd);

            previous.Add(new PreviousWeeklyChallenge(
                lesson.Id,
                lesson.Title,
                pastWeek,
                pastStart,
                pastEnd,
                completed));
        }

        return Results.Ok(previous);
    }

    // ── Week calculation helpers ──

    private static (int WeekNumber, DateTime WeekStart, DateTime WeekEnd) GetCurrentWeekInfo()
    {
        var weekNumber = ISOWeek.GetWeekOfYear(DateTime.UtcNow);
        var yearOffset = (DateTime.UtcNow.Year - 2025) * 52;
        return GetWeekInfo(weekNumber + yearOffset);
    }

    private static (int WeekNumber, DateTime WeekStart, DateTime WeekEnd) GetWeekInfo(int weekNumber)
    {
        // Reverse the year offset to get actual ISO year/week
        var year = 2025 + (weekNumber / 52);
        var isoWeek = weekNumber % 52;
        if (isoWeek <= 0)
        {
            isoWeek += 52;
            year--;
        }

        // Monday start of the ISO week
        var jan4 = new DateTime(year, 1, 4, 0, 0, 0, DateTimeKind.Utc);
        var dayOfWeek = (int)jan4.DayOfWeek;
        var mondayOfWeek1 = jan4.AddDays(-(dayOfWeek == 0 ? 6 : dayOfWeek - 1));
        var weekStart = mondayOfWeek1.AddDays((isoWeek - 1) * 7);
        var weekEnd = weekStart.AddDays(7);

        return (weekNumber, weekStart, weekEnd);
    }
}
