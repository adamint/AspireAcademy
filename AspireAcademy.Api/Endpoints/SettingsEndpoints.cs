using System.Security.Claims;
using AspireAcademy.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

public static class SettingsEndpoints
{
    private static ILogger s_logger = null!;

    public static WebApplication MapSettingsEndpoints(this WebApplication app)
    {
        s_logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("SettingsEndpoints");

        var authGroup = app.MapGroup("/api/auth").WithTags("Auth").RequireAuthorization();
        authGroup.MapPut("/change-password", ChangePassword);
        authGroup.MapDelete("/account", DeleteAccount);

        var settingsGroup = app.MapGroup("/api/settings").WithTags("Settings").RequireAuthorization();
        settingsGroup.MapGet("/export", ExportData);

        return app;
    }

    private static async Task<IResult> ChangePassword(
        ChangePasswordRequest request,
        ClaimsPrincipal principal,
        AcademyDbContext db)
    {
        var userId = EndpointHelpers.GetUserId(principal);
        s_logger.LogInformation("Change password attempt for UserId={UserId}", userId);

        if (string.IsNullOrWhiteSpace(request.CurrentPassword) ||
            string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return Results.BadRequest(new ErrorResponse("Current password and new password are required."));
        }

        if (request.NewPassword.Length < 8 ||
            !request.NewPassword.Any(char.IsUpper) ||
            !request.NewPassword.Any(char.IsDigit))
        {
            return Results.BadRequest(new ErrorResponse("Password must be 8+ characters with at least 1 uppercase letter and 1 digit."));
        }

        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return Results.NotFound(new ErrorResponse("User not found."));
        }

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            s_logger.LogInformation("Change password failed: incorrect current password for UserId={UserId}", userId);
            return Results.Json(new ErrorResponse("Current password is incorrect."), statusCode: 401);
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await db.SaveChangesAsync();

        s_logger.LogInformation("Password changed successfully for UserId={UserId}", userId);
        return Results.Ok(new { message = "Password changed successfully." });
    }

    private static async Task<IResult> ExportData(
        ClaimsPrincipal principal,
        AcademyDbContext db)
    {
        var userId = EndpointHelpers.GetUserId(principal);
        s_logger.LogInformation("Data export requested for UserId={UserId}", userId);

        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return Results.NotFound(new ErrorResponse("User not found."));
        }

        var xp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId);

        var progress = await db.UserProgress
            .Where(p => p.UserId == userId)
            .Select(p => new
            {
                p.LessonId,
                p.Status,
                p.Score,
                p.CompletedAt,
            })
            .ToListAsync();

        var submissions = await db.CodeSubmissions
            .Where(s => s.UserId == userId)
            .Select(s => new
            {
                s.ChallengeId,
                s.SubmittedCode,
                s.AllPassed,
                s.SubmittedAt,
            })
            .ToListAsync();

        var achievements = await db.UserAchievements
            .Where(a => a.UserId == userId)
            .Include(a => a.Achievement)
            .Select(a => new
            {
                a.Achievement!.Name,
                a.Achievement.Icon,
                a.Achievement.Rarity,
                a.UnlockedAt,
            })
            .ToListAsync();

        var exportData = new
        {
            ExportedAt = DateTime.UtcNow,
            Profile = new
            {
                user.Username,
                user.DisplayName,
                user.Email,
                user.Bio,
                user.CreatedAt,
                user.LoginStreakDays,
            },
            Xp = xp is null ? null : new
            {
                xp.TotalXp,
                xp.CurrentLevel,
                xp.CurrentRank,
                xp.WeeklyXp,
            },
            Progress = progress,
            Submissions = submissions,
            Achievements = achievements,
        };

        s_logger.LogInformation("Data export completed for UserId={UserId}", userId);
        return Results.Ok(exportData);
    }

    private static async Task<IResult> DeleteAccount(
        DeleteAccountRequest request,
        ClaimsPrincipal principal,
        AcademyDbContext db)
    {
        var userId = EndpointHelpers.GetUserId(principal);
        s_logger.LogInformation("Account deletion requested for UserId={UserId}", userId);

        if (request.Confirmation != "DELETE")
        {
            return Results.BadRequest(new ErrorResponse("You must type DELETE to confirm account deletion."));
        }

        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return Results.NotFound(new ErrorResponse("User not found."));
        }

        user.IsDeleted = true;
        user.DeletedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        s_logger.LogInformation("Account soft-deleted for UserId={UserId}", userId);
        return Results.Ok(new { message = "Account has been deleted." });
    }
}

public record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

public record DeleteAccountRequest(string? Confirmation);
