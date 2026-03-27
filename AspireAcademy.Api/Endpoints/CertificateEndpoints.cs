using System.Security.Claims;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

public record CertificateDto(
    string WorldId,
    string WorldName,
    string WorldIcon,
    int WorldSortOrder,
    DateTime? CompletedAt,
    int LessonsCompleted,
    int TotalLessons,
    int XpEarned,
    int QuizzesPassed,
    bool IsComplete);

public record CertificatesResponse(
    List<CertificateDto> Certificates,
    bool AllWorldsComplete,
    int TotalXp,
    string DisplayName);

public static class CertificateEndpoints
{
    public static WebApplication MapCertificateEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api").RequireAuthorization();

        group.MapGet("/certificates", GetCertificatesAsync);

        return app;
    }

    private static async Task<IResult> GetCertificatesAsync(
        AcademyDbContext db,
        ClaimsPrincipal user)
    {
        var userId = EndpointHelpers.GetUserId(user);

        var dbUser = await db.Users
            .Include(u => u.Xp)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (dbUser is null)
        {
            return Results.NotFound(new ErrorResponse("User not found"));
        }

        var worlds = await db.Worlds
            .Include(w => w.Modules)
                .ThenInclude(m => m.Lessons)
            .OrderBy(w => w.SortOrder)
            .ToListAsync();

        var userProgress = await db.UserProgress
            .Where(p => p.UserId == userId && EndpointHelpers.CompletedStatuses.Contains(p.Status))
            .ToListAsync();

        var progressByLesson = userProgress.ToDictionary(p => p.LessonId);

        // Count quizzes passed per world
        var quizLessonIds = worlds
            .SelectMany(w => w.Modules)
            .SelectMany(m => m.Lessons)
            .Where(l => l.Type == LessonTypes.Quiz)
            .Select(l => l.Id)
            .ToHashSet();

        var certificates = new List<CertificateDto>();

        foreach (var world in worlds)
        {
            var allLessons = world.Modules
                .SelectMany(m => m.Lessons)
                .ToList();

            var totalLessons = allLessons.Count;

            var completedLessons = allLessons
                .Count(l => progressByLesson.ContainsKey(l.Id));

            var xpEarned = allLessons
                .Where(l => progressByLesson.ContainsKey(l.Id))
                .Sum(l => progressByLesson[l.Id].XpEarned);

            var quizzesPassed = allLessons
                .Count(l => quizLessonIds.Contains(l.Id) && progressByLesson.ContainsKey(l.Id));

            var isComplete = totalLessons > 0 && completedLessons >= totalLessons;

            // Find the latest completion date for this world
            DateTime? completedAt = null;
            if (isComplete)
            {
                completedAt = allLessons
                    .Where(l => progressByLesson.ContainsKey(l.Id))
                    .Select(l => progressByLesson[l.Id].CompletedAt)
                    .Where(d => d.HasValue)
                    .Max();
            }

            certificates.Add(new CertificateDto(
                WorldId: world.Id,
                WorldName: world.Name,
                WorldIcon: world.Icon,
                WorldSortOrder: world.SortOrder,
                CompletedAt: completedAt,
                LessonsCompleted: completedLessons,
                TotalLessons: totalLessons,
                XpEarned: xpEarned,
                QuizzesPassed: quizzesPassed,
                IsComplete: isComplete));
        }

        var allWorldsComplete = certificates.Count > 0 && certificates.All(c => c.IsComplete);

        return Results.Ok(new CertificatesResponse(
            Certificates: certificates,
            AllWorldsComplete: allWorldsComplete,
            TotalXp: dbUser.Xp?.TotalXp ?? 0,
            DisplayName: dbUser.DisplayName));
    }
}
