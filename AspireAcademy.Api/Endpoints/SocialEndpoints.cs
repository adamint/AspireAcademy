using System.Security.Claims;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

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
            var userId = GetUserId(user);
            s_logger.LogInformation("GET /friends for UserId={UserId}", userId);

            // Accepted friends where current user is the requester
            var friendsAsRequester = (await db.Friendships
                .Where(f => f.RequesterId == userId && f.Status == "accepted")
                .Join(db.Users, f => f.AddresseeId, u => u.Id, (f, u) => new { f, u })
                .Join(db.UserXp, fu => fu.u.Id, x => x.UserId, (fu, x) => new
                {
                    fu.u.Id, fu.u.Username, fu.u.DisplayName, fu.u.AvatarSeed, fu.u.Email,
                    x.CurrentLevel, x.CurrentRank, x.TotalXp, fu.u.LoginStreakDays, FriendshipId = fu.f.Id
                })
                .ToListAsync())
                .Select(r => new FriendDto(
                    r.Id, r.Username, r.DisplayName, AvatarHelper.GetAvatarUrl(r.AvatarSeed, r.Email),
                    r.CurrentLevel, r.CurrentRank, r.TotalXp, r.LoginStreakDays, r.FriendshipId))
                .ToList();

            // Accepted friends where current user is the addressee
            var friendsAsAddressee = (await db.Friendships
                .Where(f => f.AddresseeId == userId && f.Status == "accepted")
                .Join(db.Users, f => f.RequesterId, u => u.Id, (f, u) => new { f, u })
                .Join(db.UserXp, fu => fu.u.Id, x => x.UserId, (fu, x) => new
                {
                    fu.u.Id, fu.u.Username, fu.u.DisplayName, fu.u.AvatarSeed, fu.u.Email,
                    x.CurrentLevel, x.CurrentRank, x.TotalXp, fu.u.LoginStreakDays, FriendshipId = fu.f.Id
                })
                .ToListAsync())
                .Select(r => new FriendDto(
                    r.Id, r.Username, r.DisplayName, AvatarHelper.GetAvatarUrl(r.AvatarSeed, r.Email),
                    r.CurrentLevel, r.CurrentRank, r.TotalXp, r.LoginStreakDays, r.FriendshipId))
                .ToList();

            var friends = friendsAsRequester.Concat(friendsAsAddressee).ToList();

            // Pending requests received
            var pendingReceived = (await db.Friendships
                .Where(f => f.AddresseeId == userId && f.Status == "pending")
                .Join(db.Users, f => f.RequesterId, u => u.Id, (f, u) => new { f, u })
                .Join(db.UserXp, fu => fu.u.Id, x => x.UserId, (fu, x) => new
                {
                    FriendshipId = fu.f.Id, fu.u.Id, fu.u.Username, fu.u.DisplayName, fu.u.AvatarSeed, fu.u.Email,
                    x.CurrentLevel, fu.f.CreatedAt
                })
                .ToListAsync())
                .Select(r => new PendingFriendDto(
                    r.FriendshipId,
                    new FriendUserDto(r.Id, r.Username, r.DisplayName, AvatarHelper.GetAvatarUrl(r.AvatarSeed, r.Email), r.CurrentLevel),
                    r.CreatedAt))
                .ToList();

            // Pending requests sent
            var pendingSent = (await db.Friendships
                .Where(f => f.RequesterId == userId && f.Status == "pending")
                .Join(db.Users, f => f.AddresseeId, u => u.Id, (f, u) => new { f, u })
                .Join(db.UserXp, fu => fu.u.Id, x => x.UserId, (fu, x) => new
                {
                    FriendshipId = fu.f.Id, fu.u.Id, fu.u.Username, fu.u.DisplayName, fu.u.AvatarSeed, fu.u.Email,
                    x.CurrentLevel, fu.f.CreatedAt
                })
                .ToListAsync())
                .Select(r => new PendingFriendDto(
                    r.FriendshipId,
                    new FriendUserDto(r.Id, r.Username, r.DisplayName, AvatarHelper.GetAvatarUrl(r.AvatarSeed, r.Email), r.CurrentLevel),
                    r.CreatedAt))
                .ToList();

            return Results.Ok(new FriendsResponse(friends, pendingReceived, pendingSent));
        });

        group.MapPost("/friends/request", async (FriendRequestDto request, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var userId = GetUserId(user);
            s_logger.LogInformation("Friend request from UserId={UserId} to Username={Username}", userId, request.Username);

            var targetUser = await db.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            if (targetUser is null)
            {
                return Results.NotFound(new { error = "User not found." });
            }

            if (targetUser.Id == userId)
            {
                return Results.BadRequest(new { error = "You cannot send a friend request to yourself." });
            }

            var existingFriendship = await db.Friendships.FirstOrDefaultAsync(f =>
                (f.RequesterId == userId && f.AddresseeId == targetUser.Id) ||
                (f.RequesterId == targetUser.Id && f.AddresseeId == userId));

            if (existingFriendship is not null)
            {
                var message = existingFriendship.Status == "accepted"
                    ? "Already friends."
                    : "Friend request already pending.";
                return Results.Conflict(new { error = message });
            }

            var friendship = new Friendship
            {
                Id = Guid.NewGuid(),
                RequesterId = userId,
                AddresseeId = targetUser.Id,
                Status = "pending",
                CreatedAt = DateTime.UtcNow
            };

            db.Friendships.Add(friendship);
            await db.SaveChangesAsync();

            s_logger.LogInformation("Friend request created: FriendshipId={FriendshipId} from {RequesterId} to {AddresseeId}",
                friendship.Id, userId, targetUser.Id);

            return Results.Created($"/api/friends/{friendship.Id}", new { friendshipId = friendship.Id });
        });

        group.MapPost("/friends/{friendshipId:guid}/accept", async (Guid friendshipId, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var userId = GetUserId(user);

            var friendship = await db.Friendships.FindAsync(friendshipId);
            if (friendship is null)
            {
                return Results.NotFound(new { error = "Friendship not found." });
            }

            if (friendship.AddresseeId != userId)
            {
                return Results.BadRequest(new { error = "Only the addressee can accept a friend request." });
            }

            if (friendship.Status != "pending")
            {
                return Results.BadRequest(new { error = "Friend request is not pending." });
            }

            friendship.Status = "accepted";
            await db.SaveChangesAsync();

            s_logger.LogInformation("Friend accepted: FriendshipId={FriendshipId}", friendshipId);

            return Results.Ok(new { success = true });
        });

        group.MapDelete("/friends/{friendshipId:guid}", async (Guid friendshipId, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var userId = GetUserId(user);

            var friendship = await db.Friendships.FindAsync(friendshipId);
            if (friendship is null)
            {
                return Results.NotFound(new { error = "Friendship not found." });
            }

            if (friendship.RequesterId != userId && friendship.AddresseeId != userId)
            {
                return Results.Forbid();
            }

            db.Friendships.Remove(friendship);
            await db.SaveChangesAsync();

            return Results.NoContent();
        });

        group.MapPut("/users/me", async (UpdateProfileRequest request, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var userId = GetUserId(user);
            s_logger.LogInformation("PUT /users/me for UserId={UserId}", userId);

            if (request.DisplayName is not null && request.DisplayName.Trim().Length > 50)
            {
                return Results.BadRequest(new { error = "Display name must be 50 characters or fewer." });
            }

            if (request.Bio is not null && request.Bio.Trim().Length > 500)
            {
                return Results.BadRequest(new { error = "Bio must be 500 characters or fewer." });
            }

            var dbUser = await db.Users.FindAsync(userId);
            if (dbUser is null)
            {
                return Results.NotFound(new { error = "User not found." });
            }

            if (!string.IsNullOrWhiteSpace(request.DisplayName))
            {
                dbUser.DisplayName = request.DisplayName.Trim();
            }

            dbUser.Bio = request.Bio?.Trim();

            await db.SaveChangesAsync();

            var userXp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId);
            var avatarUrl = AvatarHelper.GetAvatarUrl(dbUser.AvatarSeed, dbUser.Email);

            return Results.Ok(new MeResponse(
                dbUser.Id, dbUser.Username, dbUser.DisplayName, dbUser.Email,
                avatarUrl, userXp?.CurrentLevel ?? 1, userXp?.CurrentRank ?? "aspire-intern", userXp?.TotalXp ?? 0,
                dbUser.Bio, dbUser.LoginStreakDays, dbUser.CreatedAt));
        });

        group.MapGet("/users/search", async (string? q, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            {
                return Results.BadRequest(new { error = "Search query must be at least 2 characters." });
            }

            var userId = GetUserId(user);
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
                    u.Id, u.Username, u.DisplayName, AvatarHelper.GetAvatarUrl(u.AvatarSeed, u.Email), xp?.CurrentLevel ?? 1,
                    friendship?.Status == "accepted",
                    friendship?.Status == "pending");
            }).ToList();

            return Results.Ok(results);
        });

        group.MapGet("/users/{userId:guid}/profile", async (Guid userId, AcademyDbContext db, ClaimsPrincipal user) =>
        {
            var currentUserId = GetUserId(user);

            var profileUser = await db.Users.FindAsync(userId);
            if (profileUser is null)
            {
                return Results.NotFound(new { error = "User not found." });
            }

            var achievementCount = await db.UserAchievements.CountAsync(ua => ua.UserId == userId);
            var completedLessons = await db.UserProgress
                .CountAsync(up => up.UserId == userId && (up.Status == "completed" || up.Status == "perfect"));
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
                f.Status == "accepted");

            var avatarUrl = AvatarHelper.GetAvatarUrl(profileUser.AvatarSeed, profileUser.Email);

            return Results.Ok(new UserProfileResponse(
                profileUser.Id, profileUser.Username, profileUser.DisplayName, profileUser.Bio,
                avatarUrl,
                profileXp?.CurrentLevel ?? 1, profileXp?.CurrentRank ?? "aspire-intern", profileXp?.TotalXp ?? 0, profileUser.LoginStreakDays,
                profileUser.CreatedAt, achievementCount, completedLessons, totalLessons,
                showcaseAchievements,
                friendship is not null,
                friendship?.Id));
        });

        group.MapGet("/leaderboard", async (string? scope, int? limit, AcademyDbContext db, IConnectionMultiplexer redis, ClaimsPrincipal user) =>
        {
            var userId = GetUserId(user);
            scope ??= "weekly";
            var maxLimit = Math.Clamp(limit ?? 50, 1, 50);

            if (scope == "friends")
            {
                return await GetFriendsLeaderboard(userId, maxLimit, db);
            }

            return await GetRedisLeaderboard(userId, scope, maxLimit, db, redis);
        });

        return app;
    }

    private static async Task<IResult> GetFriendsLeaderboard(Guid userId, int maxLimit, AcademyDbContext db)
    {
        var friendIds = await db.Friendships
            .Where(f => (f.RequesterId == userId || f.AddresseeId == userId) && f.Status == "accepted")
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .ToListAsync();
        friendIds.Add(userId);

        var entries = (await db.UserXp
            .Where(x => friendIds.Contains(x.UserId))
            .Join(db.Users, x => x.UserId, u => u.Id, (x, u) => new { u, x })
            .OrderByDescending(ux => ux.x.TotalXp)
            .Take(maxLimit)
            .Select(ux => new { ux.u.Id, ux.u.Username, ux.u.DisplayName, ux.u.AvatarSeed, ux.u.Email, ux.x.TotalXp, ux.x.CurrentLevel })
            .ToListAsync())
            .Select(r => new LeaderboardEntry(0, r.Id, r.Username, r.DisplayName, AvatarHelper.GetAvatarUrl(r.AvatarSeed, r.Email), r.TotalXp, r.CurrentLevel))
            .ToList();

        // Assign ranks after materializing
        for (var i = 0; i < entries.Count; i++)
        {
            entries[i] = entries[i] with { Rank = i + 1 };
        }

        var userEntry = entries.FirstOrDefault(e => e.UserId == userId);

        return Results.Ok(new LeaderboardResponse(entries, userEntry?.Rank ?? 0, userEntry, "friends", entries.Count));
    }

    private static async Task<IResult> GetRedisLeaderboard(Guid userId, string scope, int maxLimit, AcademyDbContext db, IConnectionMultiplexer redis)
    {
        var redisDb = redis.GetDatabase();
        var key = scope == "weekly" ? "leaderboard:weekly" : "leaderboard:alltime";

        var sortedEntries = await redisDb.SortedSetRangeByRankWithScoresAsync(key, 0, maxLimit - 1, Order.Descending);

        if (sortedEntries is null || sortedEntries.Length == 0)
        {
            return Results.Ok(new LeaderboardResponse([], 0, null, scope, 0));
        }

        var userIds = sortedEntries
            .Select(e => Guid.TryParse(e.Element.ToString(), out var id) ? id : (Guid?)null)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .ToList();

        var users = await db.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id);

        var xpByUser = await db.UserXp
            .Where(x => userIds.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId);

        var entries = sortedEntries.Select((e, i) =>
        {
            if (!Guid.TryParse(e.Element.ToString(), out var uid))
            {
                return null;
            }
            var u = users.GetValueOrDefault(uid);
            var xp = xpByUser.GetValueOrDefault(uid);
            var avatarUrl = AvatarHelper.GetAvatarUrl(u?.AvatarSeed, u?.Email ?? "");
            return new LeaderboardEntry(
                i + 1, uid,
                u?.Username ?? "", u?.DisplayName ?? "", avatarUrl,
                (int)e.Score, xp?.CurrentLevel ?? 1);
        }).Where(e => e is not null).Cast<LeaderboardEntry>().ToList();

        var userRank = await redisDb.SortedSetRankAsync(key, userId.ToString(), Order.Descending);
        LeaderboardEntry? currentUserEntry = null;

        if (userRank.HasValue)
        {
            var userScore = await redisDb.SortedSetScoreAsync(key, userId.ToString());
            var currentUser = await db.Users.FindAsync(userId);
            var currentUserXp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId);

            if (currentUser is not null)
            {
                var currentUserAvatarUrl = AvatarHelper.GetAvatarUrl(currentUser.AvatarSeed, currentUser.Email);
                currentUserEntry = new LeaderboardEntry(
                    (int)userRank.Value + 1, userId,
                    currentUser.Username, currentUser.DisplayName, currentUserAvatarUrl,
                    (int)(userScore ?? 0), currentUserXp?.CurrentLevel ?? 1);
            }
        }

        var totalEntries = await redisDb.SortedSetLengthAsync(key);

        return Results.Ok(new LeaderboardResponse(
            entries,
            currentUserEntry?.Rank ?? 0,
            currentUserEntry,
            scope,
            (int)totalEntries));
    }

    private static Guid GetUserId(ClaimsPrincipal user)
    {
        var idClaim = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (idClaim is null || !Guid.TryParse(idClaim, out var userId))
        {
            throw new BadHttpRequestException("Invalid or missing user identity.", StatusCodes.Status401Unauthorized);
        }

        return userId;
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

file record UpdateProfileRequest(string? DisplayName, string? Bio);

file record UserSearchResult(
    Guid Id, string Username, string DisplayName, string AvatarUrl,
    int CurrentLevel, bool IsFriend, bool IsPending);

file record UserProfileResponse(
    Guid Id, string Username, string DisplayName, string? Bio,
    string AvatarUrl,
    int CurrentLevel, string CurrentRank, int TotalXp, int LoginStreakDays,
    DateTime CreatedAt, int AchievementCount, int CompletedLessons, int TotalLessons,
    List<ShowcaseAchievementDto> ShowcaseAchievements,
    bool IsFriend, Guid? FriendshipId);

file record ShowcaseAchievementDto(string Id, string Name, string Icon, string Rarity);

file record LeaderboardEntry(int Rank, Guid UserId, string Username, string DisplayName, string AvatarUrl, int Xp, int Level);

file record LeaderboardResponse(
    List<LeaderboardEntry> Entries,
    int UserRank,
    LeaderboardEntry? UserEntry,
    string Scope,
    int TotalEntries);
