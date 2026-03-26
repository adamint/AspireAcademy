using System.Security.Claims;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

/// <summary>
/// Shared helper methods used across endpoint groups to avoid duplication.
/// </summary>
internal static class EndpointHelpers
{
    /// <summary>
    /// Extracts the authenticated user's ID from the claims principal.
    /// Supports both <see cref="ClaimTypes.NameIdentifier"/> and the "sub" claim.
    /// </summary>
    internal static Guid GetUserId(ClaimsPrincipal principal)
    {
        var idClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub");

        if (idClaim is null || !Guid.TryParse(idClaim, out var userId))
        {
            throw new BadHttpRequestException("Invalid or missing user identity.", StatusCodes.Status401Unauthorized);
        }

        return userId;
    }

    /// <summary>
    /// Checks whether a lesson is unlocked for the given user based on prerequisite progress.
    /// </summary>
    internal static async Task<bool> IsLessonUnlockedAsync(AcademyDbContext db, Guid userId, Lesson lesson)
    {
        if (lesson.UnlockAfterLessonId is null)
        {
            return true;
        }

        var prereqProgress = await db.UserProgress
            .FirstOrDefaultAsync(p => p.UserId == userId && p.LessonId == lesson.UnlockAfterLessonId);

        return prereqProgress?.Status is ProgressStatuses.Completed or ProgressStatuses.Perfect or ProgressStatuses.Skipped;
    }
}
