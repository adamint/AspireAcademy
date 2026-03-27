using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Microsoft.IdentityModel.Tokens;

namespace AspireAcademy.Api.Tests;

/// <summary>
/// Adversarial security tests that validate fixes for identified vulnerabilities.
/// </summary>
public class SecurityTests : TestFixture
{
    // Vuln 1 and 2: Admin endpoints require auth and reject guessable headers

    [Fact]
    public async Task AdminStats_WithoutJwt_Returns401()
    {
        using var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Client", "true");

        var response = await client.GetAsync("/api/admin/stats");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AdminStats_WithFakeAspireHeader_Returns401()
    {
        using var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Client", "true");
        client.DefaultRequestHeaders.Add("X-Aspire-Admin", "aspire-internal");

        var response = await client.GetAsync("/api/admin/stats");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AdminDeleteUser_WithoutJwt_Returns401()
    {
        using var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Client", "true");

        var response = await client.DeleteAsync("/api/admin/users/" + TestUserId.ToString());

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AdminFlushDb_WithFakeAspireHeader_Returns401()
    {
        using var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Client", "true");
        client.DefaultRequestHeaders.Add("X-Aspire-Admin", "aspire-internal");

        var response = await client.PostAsync("/api/admin/flush-db", null);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task AdminStats_AsNonAdminUser_Returns403()
    {
        using var client = CreateAuthenticatedClient(TestUserId, "testuser");

        var response = await client.GetAsync("/api/admin/stats");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task AdminStats_WithCorrectInternalSecret_Succeeds()
    {
        using var client = CreateAuthenticatedClient(TestUserId);
        client.DefaultRequestHeaders.Add("X-Aspire-Admin", AcademyApiFactory.AdminInternalSecret);

        var response = await client.GetAsync("/api/admin/stats");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // Vuln 4: JWT forgery with wrong key is rejected

    [Fact]
    public async Task Endpoint_WithForgedJwt_Returns401()
    {
        var fakeKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes("this-is-not-the-real-key-padded-to-32ch!"));

        Claim[] claims =
        [
            new(ClaimTypes.NameIdentifier, TestUserId.ToString()),
            new(ClaimTypes.Name, "admin"),
        ];

        var token = new JwtSecurityToken(
            issuer: AcademyApiFactory.JwtIssuer,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(fakeKey, SecurityAlgorithms.HmacSha256));

        var tokenStr = new JwtSecurityTokenHandler().WriteToken(token);

        using var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Client", "true");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokenStr);

        var response = await client.GetAsync("/api/worlds");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // Vuln 5: Refresh rejects very old expired tokens

    [Fact]
    public async Task Refresh_WithVeryOldToken_Returns401()
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(AcademyApiFactory.JwtKey));

        Claim[] claims =
        [
            new(ClaimTypes.NameIdentifier, TestUserId.ToString()),
            new(ClaimTypes.Name, "testuser"),
        ];

        var oldToken = new JwtSecurityToken(
            issuer: AcademyApiFactory.JwtIssuer,
            audience: AcademyApiFactory.JwtIssuer,
            claims: claims,
            expires: DateTime.UtcNow.AddDays(-30),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        var tokenStr = new JwtSecurityTokenHandler().WriteToken(oldToken);

        var response = await Client.PostAsJsonAsync("/api/auth/refresh", new { token = tokenStr });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Refresh_WithRecentlyExpiredToken_Succeeds()
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(AcademyApiFactory.JwtKey));

        Claim[] claims =
        [
            new(ClaimTypes.NameIdentifier, TestUserId.ToString()),
            new(ClaimTypes.Name, "testuser"),
        ];

        var recentToken = new JwtSecurityToken(
            issuer: AcademyApiFactory.JwtIssuer,
            audience: AcademyApiFactory.JwtIssuer,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(-1),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        var tokenStr = new JwtSecurityTokenHandler().WriteToken(recentToken);

        var response = await Client.PostAsJsonAsync("/api/auth/refresh", new { token = tokenStr });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // Vuln 6: Username/email enumeration

    [Fact]
    public async Task Register_DuplicateUsername_ReturnsGenericError()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            username = "testuser",
            email = "different@example.com",
            password = "Password1"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var error = body.GetProperty("error").GetString();

        error.Should().NotContain("Username is already taken");
        error.Should().NotContain("Email is already taken");
        error.Should().Contain("Username or email is already taken");
    }

    [Fact]
    public async Task Register_DuplicateEmail_ReturnsGenericError()
    {
        var response = await Client.PostAsJsonAsync("/api/auth/register", new
        {
            username = "differentuser",
            email = "test@example.com",
            password = "Password1"
        });

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var error = body.GetProperty("error").GetString();

        error.Should().Contain("Username or email is already taken");
    }

    // Data access: endpoints require authentication

    [Fact]
    public async Task CompleteLesson_WithoutAuth_Returns401()
    {
        using var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Client", "true");

        var response = await client.PostAsJsonAsync("/api/progress/complete",
            new { lessonId = "lesson-learn-1" });

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task XpEndpoint_RequiresAuth()
    {
        using var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Client", "true");

        var response = await client.GetAsync("/api/xp");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Achievements_IsPublic()
    {
        // Achievements catalog is intentionally public (shows all achievements, locked status for anon users)
        using var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Test-Client", "true");

        var response = await client.GetAsync("/api/achievements");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
