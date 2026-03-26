using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;

namespace AspireAcademy.Api.Tests;

public class AcademyApiFactory : WebApplicationFactory<Program>
{
    // Must match the fallback key in Program.cs because JWT bearer options are configured
    // before WebApplicationFactory's ConfigureAppConfiguration runs.
    public const string JwtKey = "dev-secret-key-change-in-production-min-32-chars!!";
    public const string JwtIssuer = "AspireAcademy";

    private readonly SqliteConnection _sqliteConnection;

    public FakeRedis FakeRedis { get; } = new();
    public FakeCodeRunnerHandler CodeRunnerHandler { get; } = new();

    public AcademyApiFactory()
    {
        // Keep an open connection to preserve the in-memory SQLite database
        _sqliteConnection = new SqliteConnection("DataSource=:memory:");
        _sqliteConnection.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Key"] = JwtKey,
                ["Jwt:Secret"] = JwtKey,
                ["Jwt:Issuer"] = JwtIssuer,
                ["Jwt:Audience"] = JwtIssuer,
                // Dummy connection string to satisfy Aspire validation (won't be used)
                ["ConnectionStrings:academydb"] = "Host=localhost;Database=fake",
                ["ConnectionStrings:cache"] = "localhost:6379",
            });
        });

        var fakeRedis = FakeRedis;
        var codeRunnerHandler = CodeRunnerHandler;
        var connection = _sqliteConnection;

        builder.ConfigureServices(services =>
        {
            // Aggressively remove all EF Core / Npgsql registrations
            var dbDescriptors = services
                .Where(d =>
                    d.ServiceType == typeof(AcademyDbContext) ||
                    d.ServiceType == typeof(DbContextOptions<AcademyDbContext>) ||
                    d.ServiceType == typeof(DbContextOptions) ||
                    d.ServiceType.FullName?.Contains("DbContextPool") == true ||
                    d.ServiceType.FullName?.Contains("IDbContextFactory") == true ||
                    d.ServiceType.FullName?.Contains("IDbContextPool") == true ||
                    d.ImplementationType?.FullName?.Contains("Npgsql") == true)
                .ToList();
            foreach (var d in dbDescriptors)
            {
                services.Remove(d);
            }

            services.AddDbContext<AcademyDbContext, TestAcademyDbContext>(options =>
                options.UseSqlite(connection),
                ServiceLifetime.Scoped, ServiceLifetime.Scoped);

            // Ensure the options are registered explicitly
            services.AddScoped(sp =>
            {
                var optionsBuilder = new DbContextOptionsBuilder<AcademyDbContext>();
                optionsBuilder.UseSqlite(connection);
                return optionsBuilder.Options;
            });

            // Replace Redis with fake
            services.RemoveAll<IConnectionMultiplexer>();
            services.AddSingleton(fakeRedis.Multiplexer);

            // Replace coderunner HttpClient handler
            services.AddHttpClient("coderunner")
                .ConfigurePrimaryHttpMessageHandler(() => codeRunnerHandler);
        });
    }
}

/// <summary>
/// Base class for integration tests. Provides a WebApplicationFactory with
/// InMemory DB, fake Redis, fake CodeRunner, and seeded test data.
/// </summary>
public abstract class TestFixture : IAsyncLifetime, IDisposable
{
    protected AcademyApiFactory Factory { get; }
    protected HttpClient Client { get; }

    // Well-known test data IDs
    protected static readonly Guid TestUserId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    protected const string TestUsername = "testuser";
    protected const string TestEmail = "test@example.com";
    protected const string TestPassword = "Password1";
    protected const string TestPasswordHash = "$2a$11$K2aBKC0eYNpRbT.nPbA6zuH3s3nSy3MXtU3VhFYqQ8q7sWzYcFKSi"; // BCrypt of "Password1"

    protected static readonly Guid QuizQuestion1Id = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    protected static readonly Guid QuizQuestion2Id = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
    protected static readonly Guid ChallengeId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");

    private static readonly JsonSerializerOptions s_jsonOptions = new(JsonSerializerDefaults.Web);

    protected TestFixture()
    {
        Factory = new AcademyApiFactory();
        Client = Factory.CreateClient();
    }

    public virtual async Task InitializeAsync()
    {
        // Create DB schema and seed data
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();
        await db.Database.EnsureCreatedAsync();
        await SeedTestDataAsync(db);
    }

    public virtual Task DisposeAsync() => Task.CompletedTask;

    public void Dispose()
    {
        Client.Dispose();
        Factory.Dispose();
        GC.SuppressFinalize(this);
    }

    // ── Helpers ──

    protected HttpClient CreateAuthenticatedClient(Guid userId, string username = "testuser")
    {
        var client = Factory.CreateClient();
        var token = GenerateTestJwt(userId, username);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    protected static string GenerateTestJwt(Guid userId, string username = "testuser")
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(AcademyApiFactory.JwtKey));
        Claim[] claims =
        [
            new(ClaimTypes.NameIdentifier, userId.ToString()),
            new(ClaimTypes.Name, username),
        ];

        var token = new JwtSecurityToken(
            issuer: AcademyApiFactory.JwtIssuer,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    protected static async Task<T?> ReadJsonAsync<T>(HttpResponseMessage response)
    {
        return await response.Content.ReadFromJsonAsync<T>(s_jsonOptions);
    }

    // ── Seed Data ──

    private static async Task SeedTestDataAsync(AcademyDbContext db)
    {
        // Worlds
        db.Worlds.AddRange(
            new World
            {
                Id = "world-1", Name = "Web Fundamentals", Description = "Learn the basics",
                Icon = "🌐", SortOrder = 1, LevelRangeStart = 1, LevelRangeEnd = 12,
                UnlockAfterWorldId = null
            },
            new World
            {
                Id = "world-2", Name = "Cloud Native", Description = "Cloud patterns",
                Icon = "☁️", SortOrder = 2, LevelRangeStart = 13, LevelRangeEnd = 24,
                UnlockAfterWorldId = "world-1"
            });

        // Modules
        db.Modules.AddRange(
            new Module
            {
                Id = "mod-1", WorldId = "world-1", Name = "Getting Started",
                Description = "First steps", SortOrder = 1, UnlockAfterModuleId = null
            },
            new Module
            {
                Id = "mod-2", WorldId = "world-1", Name = "Advanced Topics",
                Description = "Going deeper", SortOrder = 2, UnlockAfterModuleId = "mod-1"
            });

        // Lessons
        db.Lessons.AddRange(
            new Lesson
            {
                Id = "lesson-learn-1", ModuleId = "mod-1", Title = "Intro to Aspire",
                Description = "Welcome lesson", Type = "learn", SortOrder = 1,
                ContentMarkdown = "# Welcome\nLearn Aspire basics.",
                XpReward = 50, BonusXp = 0, EstimatedMinutes = 5,
                UnlockAfterLessonId = null, IsBoss = false
            },
            new Lesson
            {
                Id = "lesson-quiz-1", ModuleId = "mod-1", Title = "Aspire Quiz",
                Description = "Test your knowledge", Type = "quiz", SortOrder = 2,
                ContentMarkdown = "# Quiz\nAnswer the following questions.",
                XpReward = 100, BonusXp = 25, EstimatedMinutes = 10,
                UnlockAfterLessonId = "lesson-learn-1", IsBoss = false
            },
            new Lesson
            {
                Id = "lesson-challenge-1", ModuleId = "mod-1", Title = "Code Challenge",
                Description = "Write some code", Type = "challenge", SortOrder = 3,
                ContentMarkdown = "# Challenge\nComplete the coding challenge.",
                XpReward = 150, BonusXp = 50, EstimatedMinutes = 15,
                UnlockAfterLessonId = "lesson-quiz-1", IsBoss = false
            },
            new Lesson
            {
                Id = "lesson-locked-1", ModuleId = "mod-2", Title = "Locked Lesson",
                Description = "This lesson is locked", Type = "learn", SortOrder = 1,
                ContentMarkdown = "# Locked\nYou need to complete prereqs first.",
                XpReward = 50, BonusXp = 0, EstimatedMinutes = 5,
                UnlockAfterLessonId = "lesson-challenge-1", IsBoss = false
            },
            new Lesson
            {
                Id = "lesson-locked-quiz", ModuleId = "mod-2", Title = "Locked Quiz",
                Description = "This quiz lesson is locked", Type = "quiz", SortOrder = 2,
                ContentMarkdown = "# Locked Quiz",
                XpReward = 100, BonusXp = 25, EstimatedMinutes = 10,
                UnlockAfterLessonId = "lesson-challenge-1", IsBoss = false
            });

        // Quiz Questions for lesson-quiz-1
        db.QuizQuestions.AddRange(
            new QuizQuestion
            {
                Id = QuizQuestion1Id,
                LessonId = "lesson-quiz-1",
                QuestionText = "What is Aspire?",
                QuestionType = "multiple-choice",
                Options = JsonDocument.Parse("""
                [
                    {"id":"a","text":"A .NET framework for distributed apps","isCorrect":true},
                    {"id":"b","text":"A JavaScript library","isCorrect":false},
                    {"id":"c","text":"A database engine","isCorrect":false}
                ]
                """),
                Explanation = "Aspire is a .NET framework for building distributed applications.",
                SortOrder = 1,
                Points = 10
            },
            new QuizQuestion
            {
                Id = QuizQuestion2Id,
                LessonId = "lesson-quiz-1",
                QuestionText = "Which language does Aspire use?",
                QuestionType = "multiple-choice",
                Options = JsonDocument.Parse("""
                [
                    {"id":"a","text":"Python","isCorrect":false},
                    {"id":"b","text":"C#","isCorrect":true}
                ]
                """),
                Explanation = "Aspire uses C# as its primary language.",
                SortOrder = 2,
                Points = 10
            });

        // Quiz question for locked quiz lesson
        db.QuizQuestions.Add(new QuizQuestion
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000099"),
            LessonId = "lesson-locked-quiz",
            QuestionText = "Locked question?",
            QuestionType = "multiple-choice",
            Options = JsonDocument.Parse("""[{"id":"a","text":"Yes","isCorrect":true}]"""),
            Explanation = "Locked.",
            SortOrder = 1,
            Points = 10
        });

        // Code Challenge for lesson-challenge-1
        db.CodeChallenges.Add(new CodeChallenge
        {
            Id = ChallengeId,
            LessonId = "lesson-challenge-1",
            InstructionsMarkdown = "Write a Hello World program.",
            StarterCode = "// Write your code here",
            SolutionCode = "Console.WriteLine(\"Hello World\");",
            TestCases = JsonDocument.Parse("""
            [
                {"id":"t1","name":"Compiles","type":"compiles","description":"Code must compile","expected":null},
                {"id":"t2","name":"Output check","type":"output-contains","description":"Must contain Hello World","expected":"Hello World"}
            ]
            """),
            Hints = JsonDocument.Parse("""["Try using Console.WriteLine"]"""),
            RequiredPackages = JsonDocument.Parse("[]"),
            SortOrder = 0,
            StepTitle = "Hello World"
        });

        // Test user with hashed password
        var user = new User
        {
            Id = TestUserId,
            Username = TestUsername,
            Email = TestEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(TestPassword),
            DisplayName = "Test User",
            AvatarBase = "developer",
            AvatarAccessories = [],
            AvatarBackground = "default",
            AvatarFrame = "none",
            Bio = "I am a test user",
            CreatedAt = DateTime.UtcNow,
            LoginStreakDays = 0
        };
        db.Users.Add(user);

        db.UserXp.Add(new UserXp
        {
            UserId = TestUserId,
            TotalXp = 0,
            CurrentLevel = 1,
            CurrentRank = "aspire-intern",
            WeeklyXp = 0,
            WeekStart = DateOnly.FromDateTime(DateTime.UtcNow)
        });

        await db.SaveChangesAsync();
    }
}
