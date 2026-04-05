using System.Security.Claims;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

public static class SocialEndpoints
{
    private static ILogger s_logger = null!;

    public static WebApplication MapSocialEndpoints(this WebApplication app)
    {
        s_logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("SocialEndpoints");

        var group = app.MapGroup("/api").RequireAuthorization();

        group.MapGet("/friends", async (AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var userId = EndpointHelpers.GetUserId(user);
            s_logger.LogInformation("GET /friends for UserId={UserId}", userId);

            // Accepted friends where current user is the requester
            var friendsAsRequester = (await db.Friendships
                .Where(f => f.RequesterId == userId && f.Status == FriendshipStatuses.Accepted)
                .Join(db.Users, f => f.AddresseeId, u => u.Id, (f, u) => new { f, u })
                .Join(db.UserXp, fu => fu.u.Id, x => x.UserId, (fu, x) => new
                {
                    fu.u.Id, fu.u.Username, fu.u.DisplayName, fu.u.AvatarSeed, fu.u.Email, fu.u.GitHubUsername,
                    x.CurrentLevel, x.CurrentRank, x.TotalXp, fu.u.LoginStreakDays, FriendshipId = fu.f.Id
                })
                .ToListAsync())
                .Select(r => new FriendDto(
                    r.Id, r.Username, r.DisplayName, AvatarHelper.GetAvatarUrl(r.AvatarSeed, r.Email, r.GitHubUsername),
                    r.CurrentLevel, r.CurrentRank, r.TotalXp, r.LoginStreakDays, r.FriendshipId))
                .ToList();

            // Accepted friends where current user is the addressee
            var friendsAsAddressee = (await db.Friendships
                .Where(f => f.AddresseeId == userId && f.Status == FriendshipStatuses.Accepted)
                .Join(db.Users, f => f.RequesterId, u => u.Id, (f, u) => new { f, u })
                .Join(db.UserXp, fu => fu.u.Id, x => x.UserId, (fu, x) => new
                {
                    fu.u.Id, fu.u.Username, fu.u.DisplayName, fu.u.AvatarSeed, fu.u.Email, fu.u.GitHubUsername,
                    x.CurrentLevel, x.CurrentRank, x.TotalXp, fu.u.LoginStreakDays, FriendshipId = fu.f.Id
                })
                .ToListAsync())
                .Select(r => new FriendDto(
                    r.Id, r.Username, r.DisplayName, AvatarHelper.GetAvatarUrl(r.AvatarSeed, r.Email, r.GitHubUsername),
                    r.CurrentLevel, r.CurrentRank, r.TotalXp, r.LoginStreakDays, r.FriendshipId))
                .ToList();

            var friends = friendsAsRequester.Concat(friendsAsAddressee).ToList();

            // Pending requests received
            var pendingReceived = (await db.Friendships
                .Where(f => f.AddresseeId == userId && f.Status == FriendshipStatuses.Pending)
                .Join(db.Users, f => f.RequesterId, u => u.Id, (f, u) => new { f, u })
                .Join(db.UserXp, fu => fu.u.Id, x => x.UserId, (fu, x) => new
                {
                    FriendshipId = fu.f.Id, fu.u.Id, fu.u.Username, fu.u.DisplayName, fu.u.AvatarSeed, fu.u.Email, fu.u.GitHubUsername,
                    x.CurrentLevel, fu.f.CreatedAt
                })
                .ToListAsync())
                .Select(r => new PendingFriendDto(
                    r.FriendshipId,
                    new FriendUserDto(r.Id, r.Username, r.DisplayName, AvatarHelper.GetAvatarUrl(r.AvatarSeed, r.Email, r.GitHubUsername), r.CurrentLevel),
                    r.CreatedAt))
                .ToList();

            // Pending requests sent
            var pendingSent = (await db.Friendships
                .Where(f => f.RequesterId == userId && f.Status == FriendshipStatuses.Pending)
                .Join(db.Users, f => f.AddresseeId, u => u.Id, (f, u) => new { f, u })
                .Join(db.UserXp, fu => fu.u.Id, x => x.UserId, (fu, x) => new
                {
                    FriendshipId = fu.f.Id, fu.u.Id, fu.u.Username, fu.u.DisplayName, fu.u.AvatarSeed, fu.u.Email, fu.u.GitHubUsername,
                    x.CurrentLevel, fu.f.CreatedAt
                })
                .ToListAsync())
                .Select(r => new PendingFriendDto(
                    r.FriendshipId,
                    new FriendUserDto(r.Id, r.Username, r.DisplayName, AvatarHelper.GetAvatarUrl(r.AvatarSeed, r.Email, r.GitHubUsername), r.CurrentLevel),
                    r.CreatedAt))
                .ToList();

            return Results.Ok(new FriendsResponse(friends, pendingReceived, pendingSent));
        });

        group.MapPost("/friends/request", async ([FromBody] FriendRequestDto request, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var userId = EndpointHelpers.GetUserId(user);
            s_logger.LogInformation("Friend request from UserId={UserId} to Username={Username}", userId, request.Username);

            var targetUser = await db.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            if (targetUser is null)
            {
                return Results.BadRequest(new ErrorResponse("Friend request could not be sent."));
            }

            if (targetUser.Id == userId)
            {
                return Results.BadRequest(new ErrorResponse("You cannot send a friend request to yourself."));
            }

            var existingFriendship = await db.Friendships.FirstOrDefaultAsync(f =>
                (f.RequesterId == userId && f.AddresseeId == targetUser.Id) ||
                (f.RequesterId == targetUser.Id && f.AddresseeId == userId));

            if (existingFriendship is not null)
            {
                var message = existingFriendship.Status == FriendshipStatuses.Accepted
                    ? "Already friends."
                    : "Friend request already pending.";
                return Results.Conflict(new ErrorResponse(message));
            }

            var friendship = new Friendship
            {
                Id = Guid.NewGuid(),
                RequesterId = userId,
                AddresseeId = targetUser.Id,
                Status = FriendshipStatuses.Pending,
                CreatedAt = DateTime.UtcNow
            };

            db.Friendships.Add(friendship);
            await db.SaveChangesAsync();

            s_logger.LogInformation("Friend request created: FriendshipId={FriendshipId} from {RequesterId} to {AddresseeId}",
                friendship.Id, userId, targetUser.Id);

            return Results.Created($"/api/friends/{friendship.Id}", new { friendshipId = friendship.Id });
        }).RequireRateLimiting("social-write");

        group.MapPost("/friends/{friendshipId:guid}/accept", async (Guid friendshipId, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var userId = EndpointHelpers.GetUserId(user);

            var friendship = await db.Friendships.FindAsync(friendshipId);
            if (friendship is null)
            {
                return Results.NotFound(new ErrorResponse("Friendship not found."));
            }

            if (friendship.AddresseeId != userId)
            {
                return Results.BadRequest(new ErrorResponse("Only the addressee can accept a friend request."));
            }

            if (friendship.Status != FriendshipStatuses.Pending)
            {
                return Results.BadRequest(new ErrorResponse("Friend request is not pending."));
            }

            friendship.Status = FriendshipStatuses.Accepted;
            await db.SaveChangesAsync();

            s_logger.LogInformation("Friend accepted: FriendshipId={FriendshipId}", friendshipId);

            return Results.Ok(new { success = true });
        });

        group.MapDelete("/friends/{friendshipId:guid}", async (Guid friendshipId, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var userId = EndpointHelpers.GetUserId(user);

            var friendship = await db.Friendships.FindAsync(friendshipId);
            if (friendship is null)
            {
                return Results.NotFound(new ErrorResponse("Friendship not found."));
            }

            if (friendship.RequesterId != userId && friendship.AddresseeId != userId)
            {
                return Results.Forbid();
            }

            db.Friendships.Remove(friendship);
            await db.SaveChangesAsync();

            return Results.NoContent();
        });

        group.MapPut("/users/me", async ([FromBody] UpdateProfileRequest request, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var userId = EndpointHelpers.GetUserId(user);
            s_logger.LogInformation("PUT /users/me for UserId={UserId}", userId);

            if (request.DisplayName is not null && request.DisplayName.Trim().Length > 50)
            {
                return Results.BadRequest(new ErrorResponse("Display name must be 50 characters or fewer."));
            }

            if (request.Bio is not null && request.Bio.Trim().Length > 500)
            {
                return Results.BadRequest(new ErrorResponse("Bio must be 500 characters or fewer."));
            }

            var dbUser = await db.Users.FindAsync(userId);
            if (dbUser is null)
            {
                return Results.NotFound(new ErrorResponse("User not found."));
            }

            if (!string.IsNullOrWhiteSpace(request.DisplayName))
            {
                dbUser.DisplayName = SocialHelpers.SanitizeText(request.DisplayName.Trim());
            }

            dbUser.Bio = request.Bio is not null ? SocialHelpers.SanitizeText(request.Bio.Trim()) : null;

            // Validate GitHub username: max 39 chars, alphanumeric/hyphens, no leading/trailing hyphen
            if (request.GitHubUsername is not null)
            {
                var gh = request.GitHubUsername.Trim();
                if (gh.Length > 0)
                {
                    if (gh.Length > 39 || gh.StartsWith('-') || gh.EndsWith('-') ||
                        !System.Text.RegularExpressions.Regex.IsMatch(gh, @"^[a-zA-Z0-9-]+$"))
                    {
                        return Results.BadRequest(new ErrorResponse(
                            "GitHub username must be 1-39 characters, alphanumeric or hyphens, and cannot start or end with a hyphen."));
                    }
                    dbUser.GitHubUsername = gh;
                }
                else
                {
                    dbUser.GitHubUsername = null;
                }
            }
            else
            {
                dbUser.GitHubUsername = null;
            }

            await db.SaveChangesAsync();

            var userXp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId);
            var avatarUrl = AvatarHelper.GetAvatarUrl(dbUser.AvatarSeed, dbUser.Email, dbUser.GitHubUsername);

            return Results.Ok(new MeResponse(
                dbUser.Id, dbUser.Username, dbUser.DisplayName, dbUser.Email,
                avatarUrl, userXp?.CurrentLevel ?? 1, userXp?.CurrentRank ?? Ranks.AspireIntern, userXp?.TotalXp ?? 0,
                dbUser.Bio, dbUser.LoginStreakDays, dbUser.CreatedAt, dbUser.GitHubUsername));
        });

        group.MapGet("/users/search", async (string? q, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            {
                return Results.BadRequest(new ErrorResponse("Search query must be at least 2 characters."));
            }

            var userId = EndpointHelpers.GetUserId(user);
            var pattern = $"%{q}%";

            var matchedUsers = await db.Users
                .Where(u => u.Id != userId &&
                    (EF.Functions.ILike(u.Username, pattern) || EF.Functions.ILike(u.DisplayName, pattern)))
                .Take(20)
                .ToListAsync();

            var matchedUserIds = matchedUsers.Select(u => u.Id).ToList();

            var xpByUser = await db.UserXp
                .Where(x => matchedUserIds.Contains(x.UserId))
                .ToDictionaryAsync(x => x.UserId);

            var friendships = await db.Friendships
                .Where(f =>
                    (f.RequesterId == userId && matchedUserIds.Contains(f.AddresseeId)) ||
                    (f.AddresseeId == userId && matchedUserIds.Contains(f.RequesterId)))
                .ToListAsync();

            var results = matchedUsers.Select(u =>
            {
                var friendship = friendships.FirstOrDefault(f =>
                    (f.RequesterId == userId && f.AddresseeId == u.Id) ||
                    (f.RequesterId == u.Id && f.AddresseeId == userId));

                var xp = xpByUser.GetValueOrDefault(u.Id);
                return new UserSearchResult(
                    u.Id, u.Username, u.DisplayName, AvatarHelper.GetAvatarUrl(u.AvatarSeed, u.Email, u.GitHubUsername), xp?.CurrentLevel ?? 1,
                    friendship?.Status == FriendshipStatuses.Accepted,
                    friendship?.Status == FriendshipStatuses.Pending);
            }).ToList();

            return Results.Ok(results);
        });

        group.MapGet("/users/{userId:guid}/profile", async (Guid userId, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var currentUserId = EndpointHelpers.GetUserId(user);

            var profileUser = await db.Users.FindAsync(userId);
            if (profileUser is null)
            {
                return Results.NotFound(new ErrorResponse("User not found."));
            }

            var achievementCount = await db.UserAchievements.CountAsync(ua => ua.UserId == userId);
            var completedLessons = await db.UserProgress
                .CountAsync(up => up.UserId == userId && (up.Status == ProgressStatuses.Completed || up.Status == ProgressStatuses.Perfect));
            var totalLessons = await db.Lessons.CountAsync();

            var showcaseAchievements = await db.UserAchievements
                .Where(ua => ua.UserId == userId)
                .OrderByDescending(ua => ua.UnlockedAt)
                .Take(5)
                .Join(db.Achievements, ua => ua.AchievementId, a => a.Id, (_, a) =>
                    new ShowcaseAchievementDto(a.Id, a.Name, a.Icon, a.Rarity))
                .ToListAsync();

            var profileXp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId);

            var friendship = await db.Friendships.FirstOrDefaultAsync(f =>
                ((f.RequesterId == currentUserId && f.AddresseeId == userId) ||
                 (f.RequesterId == userId && f.AddresseeId == currentUserId)) &&
                f.Status == FriendshipStatuses.Accepted);

            var avatarUrl = AvatarHelper.GetAvatarUrl(profileUser.AvatarSeed, profileUser.Email, profileUser.GitHubUsername);

            return Results.Ok(new UserProfileResponse(
                profileUser.Id, profileUser.Username, profileUser.DisplayName, profileUser.Bio,
                avatarUrl, profileUser.GitHubUsername,
                profileXp?.CurrentLevel ?? 1, profileXp?.CurrentRank ?? Ranks.AspireIntern, profileXp?.TotalXp ?? 0, profileUser.LoginStreakDays,
                profileUser.CreatedAt, achievementCount, completedLessons, totalLessons,
                showcaseAchievements,
                friendship is not null,
                friendship?.Id));
        });

        group.MapGet("/profile/activity-heatmap", async (AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var userId = EndpointHelpers.GetUserId(user);
            var since = DateTime.UtcNow.Date.AddDays(-364);

            var lessonDays = await db.UserProgress
                .Where(up => up.UserId == userId
                    && (up.Status == ProgressStatuses.Completed || up.Status == ProgressStatuses.Perfect)
                    && up.CompletedAt != null
                    && up.CompletedAt >= since)
                .GroupBy(up => up.CompletedAt!.Value.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToListAsync();

            var submissionDays = await db.CodeSubmissions
                .Where(cs => cs.UserId == userId && cs.SubmittedAt >= since)
                .GroupBy(cs => cs.SubmittedAt.Date)
                .Select(g => new { Date = g.Key, Count = g.Count() })
                .ToListAsync();

            var merged = lessonDays
                .Concat(submissionDays)
                .GroupBy(d => d.Date)
                .Select(g => new ActivityDay(g.Key.ToString("yyyy-MM-dd"), g.Sum(x => x.Count)))
                .OrderBy(d => d.Date)
                .ToList();

            return Results.Ok(new ActivityHeatmapResponse(merged));
        });

        // Public leaderboard endpoint - no auth required for general leaderboard
        var publicGroup = app.MapGroup("/api");
        publicGroup.MapGet("/leaderboard", async (string? scope, int? limit, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            // Make user optional for anonymous access
            var userId = user.Identity?.IsAuthenticated == true ? EndpointHelpers.GetUserId(user) : (Guid?)null;
            scope ??= "weekly";
            var maxLimit = Math.Clamp(limit ?? 50, 1, 50);

            if (scope == "friends")
            {
                // Friends scope requires authentication
                if (!userId.HasValue)
                {
                    return Results.Unauthorized();
                }
                return await GetFriendsLeaderboard(userId.Value, maxLimit, db);
            }

            return await GetDbLeaderboard(userId, scope, maxLimit, db);
        });

        group.MapGet("/profile/skills", async (AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var userId = EndpointHelpers.GetUserId(user);

            var worlds = await db.Worlds.OrderBy(w => w.SortOrder).ToListAsync();
            var modules = await db.Modules.ToListAsync();
            var lessons = await db.Lessons.ToListAsync();

            var completedLessonIds = (await db.UserProgress
                .Where(p => p.UserId == userId && (p.Status == ProgressStatuses.Completed || p.Status == ProgressStatuses.Perfect))
                .Select(p => p.LessonId)
                .ToListAsync())
                .ToHashSet();

            var modulesByWorld = modules.GroupBy(m => m.WorldId).ToDictionary(g => g.Key, g => g.ToList());
            var lessonsByModule = lessons.GroupBy(l => l.ModuleId).ToDictionary(g => g.Key, g => g.ToList());

            var skillNames = new Dictionary<string, string>
            {
                ["world-1"] = "Distributed Problems",
                ["world-2"] = "App Model",
                ["world-3"] = "Resource Types",
                ["world-4"] = "Wiring & Discovery",
                ["world-5"] = "Integrations",
                ["world-6"] = "Observability",
                ["world-7"] = "Dashboard",
                ["world-8"] = "Testing",
                ["world-9"] = "Polyglot Internals",
                ["world-10"] = "Deployment",
                ["world-11"] = "CLI & Tools",
                ["world-12"] = "Eventing & Lifecycle",
                ["world-13"] = "Aspire Internals",
            };

            var skills = worlds.Select(world =>
            {
                var worldModules = modulesByWorld.GetValueOrDefault(world.Id, []);
                var worldLessons = worldModules
                    .SelectMany(m => lessonsByModule.GetValueOrDefault(m.Id, []))
                    .ToList();

                var totalLessons = worldLessons.Count;
                var lessonsCompleted = worldLessons.Count(l => completedLessonIds.Contains(l.Id));
                var score = totalLessons > 0 ? (int)Math.Round(lessonsCompleted * 100.0 / totalLessons) : 0;
                var name = skillNames.GetValueOrDefault(world.Id, world.Name);

                return new SkillDto(name, score, lessonsCompleted, totalLessons);
            }).ToList();

            return Results.Ok(new SkillsResponse(skills));
        });

        return app;
    }

    private static async Task<IResult> GetFriendsLeaderboard(Guid userId, int maxLimit, AcademyDbContext db)
    {
        var friendIds = await db.Friendships
            .Where(f => (f.RequesterId == userId || f.AddresseeId == userId) && f.Status == FriendshipStatuses.Accepted)
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .ToListAsync();
        friendIds.Add(userId);

        var entries = (await db.UserXp
            .Where(x => friendIds.Contains(x.UserId))
            .Join(db.Users, x => x.UserId, u => u.Id, (x, u) => new { u, x })
            .OrderByDescending(ux => ux.x.TotalXp)
            .Take(maxLimit)
            .Select(ux => new { ux.u.Id, ux.u.Username, ux.u.DisplayName, ux.u.AvatarSeed, ux.u.Email, ux.u.GitHubUsername, ux.x.TotalXp, ux.x.CurrentLevel, ux.x.CurrentRank })
            .ToListAsync())
            .Select(r => new LeaderboardEntry(0, r.Id, r.Username, r.DisplayName, AvatarHelper.GetAvatarUrl(r.AvatarSeed, r.Email, r.GitHubUsername), r.TotalXp, r.CurrentLevel, r.CurrentRank, r.GitHubUsername))
            .ToList();

        // Assign ranks after materializing
        for (var i = 0; i < entries.Count; i++)
        {
            entries[i] = entries[i] with { Rank = i + 1 };
        }

        var userEntry = entries.FirstOrDefault(e => e.UserId == userId);

        return Results.Ok(new LeaderboardResponse(entries, userEntry?.Rank ?? 0, userEntry, "friends", entries.Count));
    }

    private static async Task<IResult> GetDbLeaderboard(Guid? userId, string scope, int maxLimit, AcademyDbContext db)
    {
        // Use the appropriate XP column based on scope
        var isWeekly = scope == "weekly";

        var query = db.UserXp
            .Join(db.Users.Where(u => !u.IsDeleted), x => x.UserId, u => u.Id, (x, u) => new { u, x })
            // Exclude E2E test users (auto-generated usernames with underscore + hex suffix)
            .Where(ux => !ux.u.Username.Contains("_") || ux.u.Username == "admin" || ux.u.Username.Length < 15);

        var orderedQuery = isWeekly
            ? query.OrderByDescending(ux => ux.x.WeeklyXp)
            : query.OrderByDescending(ux => ux.x.TotalXp);

        var topEntries = await orderedQuery
            .Take(maxLimit)
            .Select(ux => new
            {
                ux.u.Id, ux.u.Username, ux.u.DisplayName, ux.u.AvatarSeed, ux.u.Email, ux.u.GitHubUsername,
                Xp = isWeekly ? ux.x.WeeklyXp : ux.x.TotalXp,
                ux.x.CurrentLevel, ux.x.CurrentRank
            })
            .ToListAsync();

        var entries = topEntries.Select((r, i) => new LeaderboardEntry(
            i + 1, r.Id, r.Username, r.DisplayName,
            AvatarHelper.GetAvatarUrl(r.AvatarSeed, r.Email, r.GitHubUsername),
            r.Xp, r.CurrentLevel, r.CurrentRank, r.GitHubUsername)).ToList();

        LeaderboardEntry? currentUserEntry = null;
        var userRank = 0;

        if (userId.HasValue)
        {
            currentUserEntry = entries.FirstOrDefault(e => e.UserId == userId.Value);

            if (currentUserEntry is not null)
            {
                userRank = currentUserEntry.Rank;
            }
            else
            {
                // User is not in top N — compute their rank
                var userXp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId.Value);
                if (userXp is not null)
                {
                    var userXpValue = isWeekly ? userXp.WeeklyXp : userXp.TotalXp;
                    var rank = isWeekly
                        ? await db.UserXp.CountAsync(x => x.WeeklyXp > userXpValue) + 1
                        : await db.UserXp.CountAsync(x => x.TotalXp > userXpValue) + 1;

                    var currentUser = await db.Users.FindAsync(userId.Value);
                    if (currentUser is not null)
                    {
                        var avatarUrl = AvatarHelper.GetAvatarUrl(currentUser.AvatarSeed, currentUser.Email, currentUser.GitHubUsername);
                        currentUserEntry = new LeaderboardEntry(
                            rank, userId.Value, currentUser.Username, currentUser.DisplayName, avatarUrl,
                            userXpValue, userXp.CurrentLevel, userXp.CurrentRank, currentUser.GitHubUsername);
                        userRank = rank;
                    }
                }
            }
        }

        var totalEntries = await db.UserXp.CountAsync();

        return Results.Ok(new LeaderboardResponse(entries, userRank, currentUserEntry, scope, totalEntries));
    }

}

// Request / response DTOs

file record FriendsResponse(
    List<FriendDto> Friends,
    List<PendingFriendDto> PendingReceived,
    List<PendingFriendDto> PendingSent);

file record FriendDto(
    Guid Id, string Username, string DisplayName, string AvatarUrl,
    int CurrentLevel, string CurrentRank, int TotalXp, int LoginStreakDays,
    Guid FriendshipId);

file record PendingFriendDto(Guid FriendshipId, FriendUserDto User, DateTime SentAt);

file record FriendUserDto(Guid Id, string Username, string DisplayName, string AvatarUrl, int CurrentLevel);

file record FriendRequestDto(string Username);

file record UpdateProfileRequest(string? DisplayName, string? Bio, string? GitHubUsername);

file record UserSearchResult(
    Guid Id, string Username, string DisplayName, string AvatarUrl,
    int CurrentLevel, bool IsFriend, bool IsPending);

file record UserProfileResponse(
    Guid Id, string Username, string DisplayName, string? Bio,
    string AvatarUrl, string? GitHubUsername,
    int CurrentLevel, string CurrentRank, int TotalXp, int LoginStreakDays,
    DateTime CreatedAt, int AchievementCount, int CompletedLessons, int TotalLessons,
    List<ShowcaseAchievementDto> ShowcaseAchievements,
    bool IsFriend, Guid? FriendshipId);

file record ShowcaseAchievementDto(string Id, string Name, string Icon, string Rarity);

file record LeaderboardEntry(int Rank, Guid UserId, string Username, string DisplayName, string AvatarUrl, int Xp, int CurrentLevel, string CurrentRank, string? GitHubUsername);

file record LeaderboardResponse(
    List<LeaderboardEntry> Entries,
    int UserRank,
    LeaderboardEntry? UserEntry,
    string Scope,
    int TotalEntries);

file record ActivityDay(string Date, int Count);

// Strip HTML/script tags from user-supplied text to prevent stored XSS
file static class SocialHelpers
{
    private static readonly System.Text.RegularExpressions.Regex s_htmlTagRegex =
        new(@"<[^>]+>", System.Text.RegularExpressions.RegexOptions.Compiled);

    internal static string SanitizeText(string input) =>
        s_htmlTagRegex.Replace(input, string.Empty);
}

file record ActivityHeatmapResponse(List<ActivityDay> Days);

file record SkillDto(string Name, int Score, int LessonsCompleted, int TotalLessons);

file record SkillsResponse(List<SkillDto> Skills);
