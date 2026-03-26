using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using AspireAcademy.Api.Models;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

public class SocialEndpointsTests : TestFixture
{
    private static readonly Guid FriendUserId = Guid.Parse("44444444-4444-4444-4444-444444444444");

    public override async Task InitializeAsync()
    {
        await base.InitializeAsync();
        await SeedFriendUser();
    }

    // ── Friends List ──

    [Fact]
    public async Task GetFriends_Authenticated_ReturnsOk()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/friends");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("friends").GetArrayLength().Should().Be(0);
        body.GetProperty("pendingReceived").GetArrayLength().Should().Be(0);
        body.GetProperty("pendingSent").GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task GetFriends_Unauthenticated_Returns401()
    {
        var response = await Client.GetAsync("/api/friends");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Friend Request + Accept + List ──

    [Fact]
    public async Task FriendRequest_Accept_ShowsInFriendsList()
    {
        using var requesterClient = CreateAuthenticatedClient(TestUserId);
        using var addresseeClient = CreateAuthenticatedClient(FriendUserId, "frienduser2");

        // Send request
        var sendResponse = await requesterClient.PostAsJsonAsync("/api/friends/request",
            new { Username = "frienduser2" });
        sendResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var sendBody = await sendResponse.Content.ReadFromJsonAsync<JsonElement>();
        var friendshipId = sendBody.GetProperty("friendshipId").GetGuid();

        // Accept as addressee
        var acceptResponse = await addresseeClient.PostAsync($"/api/friends/{friendshipId}/accept", null);
        acceptResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Both should see each other in friends list
        var friendsResponse = await requesterClient.GetAsync("/api/friends");
        var friends = await friendsResponse.Content.ReadFromJsonAsync<JsonElement>();
        friends.GetProperty("friends").GetArrayLength().Should().BeGreaterThan(0);
    }

    // ── Delete Friendship ──

    [Fact]
    public async Task DeleteFriendship_AsRequester_Returns204()
    {
        using var requesterClient = CreateAuthenticatedClient(TestUserId);

        // Send request first
        var sendResponse = await requesterClient.PostAsJsonAsync("/api/friends/request",
            new { Username = "frienduser2" });
        var sendBody = await sendResponse.Content.ReadFromJsonAsync<JsonElement>();
        var friendshipId = sendBody.GetProperty("friendshipId").GetGuid();

        // Delete the friendship
        var deleteResponse = await requesterClient.DeleteAsync($"/api/friends/{friendshipId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task DeleteFriendship_AsThirdParty_ReturnsForbid()
    {
        using var requesterClient = CreateAuthenticatedClient(TestUserId);

        var sendResponse = await requesterClient.PostAsJsonAsync("/api/friends/request",
            new { Username = "frienduser2" });
        var sendBody = await sendResponse.Content.ReadFromJsonAsync<JsonElement>();
        var friendshipId = sendBody.GetProperty("friendshipId").GetGuid();

        // Third user trying to delete
        var thirdUserId = Guid.Parse("55555555-5555-5555-5555-555555555555");
        await SeedUser(thirdUserId, "thirduser");
        using var thirdClient = CreateAuthenticatedClient(thirdUserId, "thirduser");

        var deleteResponse = await thirdClient.DeleteAsync($"/api/friends/{friendshipId}");
        deleteResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    // ── Accept: only addressee can accept ──

    [Fact]
    public async Task AcceptFriendship_AsRequester_Returns400()
    {
        using var requesterClient = CreateAuthenticatedClient(TestUserId);

        var sendResponse = await requesterClient.PostAsJsonAsync("/api/friends/request",
            new { Username = "frienduser2" });
        var sendBody = await sendResponse.Content.ReadFromJsonAsync<JsonElement>();
        var friendshipId = sendBody.GetProperty("friendshipId").GetGuid();

        // Requester trying to accept own request
        var acceptResponse = await requesterClient.PostAsync($"/api/friends/{friendshipId}/accept", null);
        acceptResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── User Search ──

    [Fact]
    public async Task SearchUsers_ValidQuery_ReturnsResults()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/users/search?q=frienduser");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task SearchUsers_TooShortQuery_Returns400()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/users/search?q=a");

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task SearchUsers_DoesNotReturnSelf()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/users/search?q=testuser");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        foreach (var item in body.EnumerateArray())
        {
            item.GetProperty("id").GetGuid().Should().NotBe(TestUserId);
        }
    }

    // ── User Profile ──

    [Fact]
    public async Task GetUserProfile_ExistingUser_ReturnsProfile()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync($"/api/users/{FriendUserId}/profile");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("username").GetString().Should().Be("frienduser2");
    }

    [Fact]
    public async Task GetUserProfile_NonExistentUser_Returns404()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync($"/api/users/{Guid.NewGuid()}/profile");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Update Profile ──

    [Fact]
    public async Task UpdateProfile_ValidData_ReturnsUpdatedProfile()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PutAsJsonAsync("/api/users/me",
            new { DisplayName = "Updated Name", Bio = "New bio" });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("displayName").GetString().Should().Be("Updated Name");
        body.GetProperty("bio").GetString().Should().Be("New bio");
    }

    [Fact]
    public async Task UpdateProfile_TooLongDisplayName_Returns400()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PutAsJsonAsync("/api/users/me",
            new { DisplayName = new string('x', 51), Bio = "Short bio" });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task UpdateProfile_TooLongBio_Returns400()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PutAsJsonAsync("/api/users/me",
            new { DisplayName = "Name", Bio = new string('x', 501) });

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ── Leaderboard ──

    [Fact]
    public async Task GetLeaderboard_Friends_ReturnsOk()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/leaderboard?scope=friends");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetLeaderboard_Default_ReturnsOk()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/leaderboard");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("scope").GetString().Should().Be("weekly");
    }

    [Fact]
    public async Task GetLeaderboard_Alltime_ReturnsOk()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/leaderboard?scope=alltime");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("scope").GetString().Should().Be("alltime");
    }

    // ── Helpers ──

    private async Task SeedFriendUser()
    {
        await SeedUser(FriendUserId, "frienduser2");
    }

    private async Task SeedUser(Guid userId, string username)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

        if (await db.Users.FindAsync(userId) is not null)
        {
            return;
        }

        db.Users.Add(new User
        {
            Id = userId,
            Username = username,
            Email = $"{username}@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password1"),
            DisplayName = $"Test {username}",
            CreatedAt = DateTime.UtcNow,
            LoginStreakDays = 0
        });

        db.UserXp.Add(new UserXp
        {
            UserId = userId,
            TotalXp = 0,
            CurrentLevel = 1,
            CurrentRank = "aspire-intern",
            WeeklyXp = 0,
            WeekStart = DateOnly.FromDateTime(DateTime.UtcNow)
        });

        await db.SaveChangesAsync();
    }
}
