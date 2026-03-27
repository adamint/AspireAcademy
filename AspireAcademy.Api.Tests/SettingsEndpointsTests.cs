using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

public class SettingsEndpointsTests : TestFixture
{
    // ── Change Password ──

    [Fact]
    public async Task ChangePassword_WithValidRequest_ReturnsOk()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PutAsJsonAsync("/api/auth/change-password",
            new ChangePasswordRequest("Password1", "NewPassword1"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("message").GetString().Should().Contain("changed");
    }

    [Fact]
    public async Task ChangePassword_WithWrongCurrentPassword_Returns401()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PutAsJsonAsync("/api/auth/change-password",
            new ChangePasswordRequest("WrongPassword1", "NewPassword1"));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ChangePassword_WithWeakNewPassword_Returns400()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        // Missing uppercase and digit
        var response = await client.PutAsJsonAsync("/api/auth/change-password",
            new ChangePasswordRequest("Password1", "short"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ChangePassword_WithEmptyFields_Returns400()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PutAsJsonAsync("/api/auth/change-password",
            new ChangePasswordRequest("", ""));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task ChangePassword_WithoutAuth_Returns401()
    {
        var response = await Client.PutAsJsonAsync("/api/auth/change-password",
            new ChangePasswordRequest("Password1", "NewPassword1"));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Delete Account ──

    [Fact]
    public async Task DeleteAccount_WithConfirmation_SoftDeletes()
    {
        // Create a disposable user so we don't break other tests
        var userId = Guid.NewGuid();
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();
        db.Users.Add(new AspireAcademy.Api.Models.User
        {
            Id = userId,
            Username = "deleteuser",
            Email = "delete@test.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password1"),
            DisplayName = "Delete User",
            CreatedAt = DateTime.UtcNow,
            LoginStreakDays = 0
        });
        await db.SaveChangesAsync();

        using var client = CreateAuthenticatedClient(userId, "deleteuser");

        var request = new HttpRequestMessage(HttpMethod.Delete, "/api/auth/account")
        {
            Content = JsonContent.Create(new DeleteAccountRequest("DELETE"))
        };
        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Verify soft-delete
        await db.Entry(db.Users.Find(userId)!).ReloadAsync();
        db.Users.Find(userId)!.IsDeleted.Should().BeTrue();
    }

    [Fact]
    public async Task DeleteAccount_WithoutConfirmation_Returns400()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var request = new HttpRequestMessage(HttpMethod.Delete, "/api/auth/account")
        {
            Content = JsonContent.Create(new DeleteAccountRequest("NOPE"))
        };
        var response = await client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task DeleteAccount_WithoutAuth_Returns401()
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, "/api/auth/account")
        {
            Content = JsonContent.Create(new DeleteAccountRequest("DELETE"))
        };
        var response = await Client.SendAsync(request);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Export Data ──

    [Fact]
    public async Task ExportData_ReturnsUserDataJson()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/settings/export");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        body.GetProperty("exportedAt").GetString().Should().NotBeNullOrEmpty();
        body.GetProperty("profile").GetProperty("username").GetString().Should().Be(TestUsername);
        body.GetProperty("profile").GetProperty("email").GetString().Should().Be(TestEmail);
        body.TryGetProperty("progress", out _).Should().BeTrue();
        body.TryGetProperty("submissions", out _).Should().BeTrue();
        body.TryGetProperty("achievements", out _).Should().BeTrue();
    }

    [Fact]
    public async Task ExportData_WithoutAuth_Returns401()
    {
        var response = await Client.GetAsync("/api/settings/export");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
