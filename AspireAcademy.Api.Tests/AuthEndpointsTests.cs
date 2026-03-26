using System.Net;
using System.Net.Http.Json;
using AspireAcademy.Api.Endpoints;
using FluentAssertions;

namespace AspireAcademy.Api.Tests;

public class AuthEndpointsTests : TestFixture
{
    [Fact]
    public async Task Register_WithValidData_Returns201WithJwtToken()
    {
        var request = new RegisterRequest("newuser", "newuser@example.com", "Password1", "New User");

        var response = await Client.PostAsJsonAsync("/api/auth/register", request);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await ReadJsonAsync<AuthResponse>(response);
        body.Should().NotBeNull();
        body!.Token.Should().NotBeNullOrEmpty();
        body.User.Username.Should().Be("newuser");
        body.User.DisplayName.Should().Be("New User");
        body.User.CurrentLevel.Should().Be(1);
        body.User.CurrentRank.Should().Be("aspire-intern");
        body.User.TotalXp.Should().Be(0);
    }

    [Fact]
    public async Task Register_WithDuplicateUsername_Returns409()
    {
        // TestUsername ("testuser") is seeded in InitializeAsync
        var request = new RegisterRequest(TestUsername, "different@example.com", "Password1", null);

        var response = await Client.PostAsJsonAsync("/api/auth/register", request);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await ReadJsonAsync<ErrorResponse>(response);
        body.Should().NotBeNull();
        body!.Error.Should().Contain("Username");
    }

    [Fact]
    public async Task Register_WithInvalidPassword_Returns400()
    {
        var request = new RegisterRequest("validuser", "valid@example.com", "short", null);

        var response = await Client.PostAsJsonAsync("/api/auth/register", request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await ReadJsonAsync<ErrorResponse>(response);
        body.Should().NotBeNull();
        body!.Error.Should().Contain("Password");
    }

    [Fact]
    public async Task Login_WithCorrectCredentials_Returns200WithJwt()
    {
        var request = new LoginRequest(TestUsername, TestPassword);

        var response = await Client.PostAsJsonAsync("/api/auth/login", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<AuthResponse>(response);
        body.Should().NotBeNull();
        body!.Token.Should().NotBeNullOrEmpty();
        body.User.Username.Should().Be(TestUsername);
        body.User.Id.Should().Be(TestUserId);
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        var request = new LoginRequest(TestUsername, "WrongPassword99");

        var response = await Client.PostAsJsonAsync("/api/auth/login", request);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetMe_WithValidToken_Returns200WithUserData()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId, TestUsername);

        var response = await authClient.GetAsync("/api/auth/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<MeResponse>(response);
        body.Should().NotBeNull();
        body!.Id.Should().Be(TestUserId);
        body.Username.Should().Be(TestUsername);
        body.Email.Should().Be(TestEmail);
        body.DisplayName.Should().Be("Test User");
        body.Bio.Should().Be("I am a test user");
        body.CurrentLevel.Should().Be(1);
    }

    [Fact]
    public async Task GetMe_WithoutToken_Returns401()
    {
        // Client has no Authorization header
        var response = await Client.GetAsync("/api/auth/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
