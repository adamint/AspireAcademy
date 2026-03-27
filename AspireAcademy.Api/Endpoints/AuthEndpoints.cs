using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Telemetry;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace AspireAcademy.Api.Endpoints;

public static partial class AuthEndpoints
{
    private static ILogger s_logger = null!;

    public static WebApplication MapAuthEndpoints(this WebApplication app)
    {
        s_logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("AuthEndpoints");

        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/register", Register).AllowAnonymous().RequireRateLimiting("register");
        group.MapPost("/login", Login).AllowAnonymous().RequireRateLimiting("login");
        group.MapGet("/me", GetMe).RequireAuthorization();
        group.MapPost("/refresh", RefreshToken).AllowAnonymous();

        return app;
    }

    private static async Task<IResult> Register(
        RegisterRequest request,
        AcademyDbContext db,
        IConfiguration config)
    {
        s_logger.LogInformation("Register attempt for username={Username}, email={Email}", request.Username, request.Email);

        if (!UsernameRegex().IsMatch(request.Username ?? ""))
        {
            s_logger.LogInformation("Register failed: invalid username format for {Username}", request.Username);
            return Results.BadRequest(new ErrorResponse("Username must be 3-30 characters (letters, digits, underscore)."));
        }

        if (!EmailRegex().IsMatch(request.Email ?? ""))
        {
            s_logger.LogInformation("Register failed: invalid email for {Email}", request.Email);
            return Results.BadRequest(new ErrorResponse("Invalid email address."));
        }

        if (!PasswordRegex().IsMatch(request.Password ?? ""))
        {
            s_logger.LogInformation("Register failed: invalid password format for {Username}", request.Username);
            return Results.BadRequest(new ErrorResponse("Password must be 8+ characters with at least 1 uppercase letter and 1 digit."));
        }

        var usernameLower = request.Username!.ToLowerInvariant();
        var emailLower = request.Email!.ToLowerInvariant();

        // Use a single generic error to prevent username/email enumeration
        var usernameTaken = await db.Users.AnyAsync(u => u.Username.ToLower() == usernameLower);
        var emailTaken = await db.Users.AnyAsync(u => u.Email.ToLower() == emailLower);

        if (usernameTaken || emailTaken)
        {
            s_logger.LogInformation("Register failed: username or email already taken for {Username}/{Email}", request.Username, request.Email);
            return Results.Conflict(new ErrorResponse("Username or email is already taken."));
        }

        var now = DateTime.UtcNow;

        var user = new User
        {
            Id = Guid.CreateVersion7(),
            Username = request.Username!,
            Email = request.Email!,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName)
                ? request.Username!
                : request.DisplayName,
            LoginStreakDays = 0,
            CreatedAt = now
        };

        var userXp = new UserXp
        {
            UserId = user.Id,
            TotalXp = 0,
            WeeklyXp = 0,
            CurrentLevel = 1,
            CurrentRank = Ranks.AspireIntern,
            WeekStart = DateOnly.FromDateTime(DateTime.UtcNow)
        };

        db.Users.Add(user);
        db.UserXp.Add(userXp);
        await db.SaveChangesAsync();

        AcademyMetrics.UsersRegistered.Add(1);
        s_logger.LogInformation("Register succeeded for UserId={UserId}, Username={Username}", user.Id, user.Username);

        var token = GenerateJwtToken(user, config);

        var avatarUrl = AvatarHelper.GetAvatarUrl(user.AvatarSeed, user.Email, user.GitHubUsername);

        return Results.Created("/api/auth/me", new AuthResponse(
            token,
            new AuthUserDto(
                user.Id, user.Username, user.DisplayName, user.Email,
                avatarUrl, userXp.CurrentLevel, userXp.CurrentRank, userXp.TotalXp, user.GitHubUsername, user.Persona)));
    }

    private static async Task<IResult> Login(
        LoginRequest request,
        AcademyDbContext db,
        IConfiguration config)
    {
        s_logger.LogInformation("Login attempt for {UsernameOrEmail}", request.UsernameOrEmail);

        if (string.IsNullOrWhiteSpace(request.UsernameOrEmail) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            s_logger.LogInformation("Login failed: missing credentials");
            return Results.BadRequest(new ErrorResponse("Username/email and password are required."));
        }

        var input = request.UsernameOrEmail.ToLowerInvariant();

        var user = await db.Users.FirstOrDefaultAsync(u =>
            (u.Username.ToLower() == input || u.Email.ToLower() == input) && !u.IsDeleted);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            s_logger.LogInformation("Login failed: invalid credentials for {UsernameOrEmail}", request.UsernameOrEmail);
            return Results.Json(new ErrorResponse("Invalid credentials."), statusCode: 401);
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        if (user.LastLoginAt.HasValue)
        {
            var lastLogin = DateOnly.FromDateTime(user.LastLoginAt.Value);
            user.LoginStreakDays = lastLogin switch
            {
                _ when lastLogin == today.AddDays(-1) => user.LoginStreakDays + 1,
                _ when lastLogin < today.AddDays(-1) => 1,
                _ => user.LoginStreakDays // same day — no change
            };
        }
        else
        {
            user.LoginStreakDays = 1;
        }

        user.LastLoginAt = DateTime.UtcNow;

        var userXp = await db.UserXp.FirstAsync(x => x.UserId == user.Id);
        await db.SaveChangesAsync();

        AcademyMetrics.LoginsTotal.Add(1);
        var token = GenerateJwtToken(user, config);

        s_logger.LogInformation("Login succeeded for UserId={UserId}, Username={Username}", user.Id, user.Username);

        var avatarUrl = AvatarHelper.GetAvatarUrl(user.AvatarSeed, user.Email, user.GitHubUsername);

        return Results.Ok(new AuthResponse(
            token,
            new AuthUserDto(
                user.Id, user.Username, user.DisplayName, user.Email,
                avatarUrl, userXp.CurrentLevel, userXp.CurrentRank, userXp.TotalXp, user.GitHubUsername, user.Persona)));
    }

    private static async Task<IResult> GetMe(
        ClaimsPrincipal principal,
        AcademyDbContext db)
    {
        var userId = EndpointHelpers.GetUserId(principal);
        s_logger.LogInformation("GET /me for UserId={UserId}", userId);

        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            s_logger.LogWarning("GET /me: user not found for UserId={UserId}", userId);
            return Results.NotFound(new ErrorResponse("User not found."));
        }

        var userXp = await db.UserXp.FirstAsync(x => x.UserId == userId);

        var avatarUrl = AvatarHelper.GetAvatarUrl(user.AvatarSeed, user.Email, user.GitHubUsername);

        return Results.Ok(new MeResponse(
            user.Id, user.Username, user.DisplayName, user.Email,
            avatarUrl, userXp.CurrentLevel, userXp.CurrentRank, userXp.TotalXp,
            user.Bio, user.LoginStreakDays, user.CreatedAt, user.GitHubUsername, user.Persona));
    }

    private static async Task<IResult> RefreshToken(
        RefreshRequest request,
        AcademyDbContext db,
        IConfiguration config)
    {
        var principal = ValidateExpiredToken(request.Token, config);
        if (principal is null)
        {
            return Results.Json(new ErrorResponse("Invalid or expired token."), statusCode: 401);
        }

        var userIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userIdClaim is null || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Results.Json(new ErrorResponse("Invalid token claims."), statusCode: 401);
        }

        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return Results.Json(new ErrorResponse("User not found."), statusCode: 401);
        }

        var newToken = GenerateJwtToken(user, config);
        return Results.Ok(new RefreshResponse(newToken));
    }

    // --- Helpers ---

    internal static string GenerateJwtToken(User user, IConfiguration config)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(config["Jwt:Key"]!));

        Claim[] claims =
        [
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
        ];

        var token = new JwtSecurityToken(
            issuer: config["Jwt:Issuer"] ?? "AspireAcademy",
            audience: config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(24),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static ClaimsPrincipal? ValidateExpiredToken(string? token, IConfiguration config)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var key = Encoding.UTF8.GetBytes(config["Jwt:Key"]!);
        var handler = new JwtSecurityTokenHandler();

        try
        {
            var principal = handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(key),
                ValidateIssuer = true,
                ValidIssuer = config["Jwt:Issuer"] ?? "AspireAcademy",
                ValidateAudience = true,
                ValidAudience = config["Jwt:Audience"],
                ValidateLifetime = false, // allow expired tokens for refresh
            }, out var validatedToken);

            // Reject tokens that expired more than 2 days ago to limit
            // the window for reusing stolen expired tokens.
            if (validatedToken is JwtSecurityToken jwt &&
                jwt.ValidTo < DateTime.UtcNow.AddDays(-2))
            {
                return null;
            }

            return principal;
        }
        catch
        {
            return null;
        }
    }

    [GeneratedRegex(@"^[a-zA-Z0-9_]{3,30}$")]
    private static partial Regex UsernameRegex();

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();

    [GeneratedRegex(@"^(?=.*[A-Z])(?=.*\d).{8,}$")]
    private static partial Regex PasswordRegex();
}

// --- DTOs ---

public record RegisterRequest(string? Username, string? Email, string? Password, string? DisplayName);

public record LoginRequest(string? UsernameOrEmail, string? Password);

public record RefreshRequest(string? Token);

public record AuthResponse(string Token, AuthUserDto User);

public record RefreshResponse(string Token);

public record AuthUserDto(
    Guid Id,
    string Username,
    string DisplayName,
    string Email,
    string AvatarUrl,
    int CurrentLevel,
    string CurrentRank,
    int TotalXp,
    string? GitHubUsername = null,
    string? Persona = null);

public record MeResponse(
    Guid Id,
    string Username,
    string DisplayName,
    string Email,
    string AvatarUrl,
    int CurrentLevel,
    string CurrentRank,
    int TotalXp,
    string? Bio,
    int LoginStreakDays,
    DateTime CreatedAt,
    string? GitHubUsername = null,
    string? Persona = null);

public record ErrorResponse(string Error, string? Details = null);
