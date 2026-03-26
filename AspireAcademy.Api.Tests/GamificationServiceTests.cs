using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace AspireAcademy.Api.Tests;

public class GamificationServiceTests : IDisposable
{
    private readonly AcademyDbContext _db;
    private readonly GamificationService _service;
    private readonly FakeRedis _fakeRedis;
    private readonly SqliteConnection _connection;

    private static readonly Guid UserId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    public GamificationServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<AcademyDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new TestAcademyDbContext(options);
        _db.Database.EnsureCreated();
        _fakeRedis = new FakeRedis();
        _service = new GamificationService(_db, _fakeRedis.Multiplexer, NullLogger<GamificationService>.Instance);

        SeedUser();
    }

    private void SeedUser()
    {
        _db.Users.Add(new User
        {
            Id = UserId,
            Username = "gamuser",
            Email = "gam@example.com",
            PasswordHash = "hash",
            DisplayName = "Gam User",
            AvatarBase = "developer",
            AvatarAccessories = [],
            AvatarBackground = "default",
            AvatarFrame = "none",
            CreatedAt = DateTime.UtcNow,
            LoginStreakDays = 0
        });

        _db.UserXp.Add(new UserXp
        {
            UserId = UserId,
            TotalXp = 0,
            CurrentLevel = 1,
            CurrentRank = "aspire-intern",
            WeeklyXp = 0,
            WeekStart = DateOnly.FromDateTime(DateTime.UtcNow)
        });

        _db.SaveChanges();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
        GC.SuppressFinalize(this);
    }

    // ── CalculateLevel Tests ──

    [Theory]
    [InlineData(0, 1, "aspire-intern")]
    [InlineData(200, 2, "aspire-intern")]
    [InlineData(500, 3, "aspire-intern")]
    [InlineData(2000, 6, "aspire-developer")]
    [InlineData(90200, 42, "aspire-architect")]
    public void CalculateLevel_ReturnsCorrectLevelAndRank(int totalXp, int expectedLevel, string expectedRank)
    {
        var (level, rank) = GamificationService.CalculateLevel(totalXp);

        level.Should().Be(expectedLevel);
        rank.Should().Be(expectedRank);
    }

    [Fact]
    public void CalculateLevel_AtLevelBoundaries_ReturnsCorrectLevels()
    {
        // Level 2 requires cumulative 200 XP (2*100)
        GamificationService.CalculateLevel(199).Level.Should().Be(1);
        GamificationService.CalculateLevel(200).Level.Should().Be(2);

        // Level 3 requires cumulative 500 XP (200 + 300)
        GamificationService.CalculateLevel(499).Level.Should().Be(2);
        GamificationService.CalculateLevel(500).Level.Should().Be(3);
    }

    // ── AwardXp Tests ──

    [Fact]
    public async Task AwardXp_IncrementsTotal_AndCreatesXpEvent()
    {
        var result = await _service.AwardXpAsync(UserId, 100, "lesson-complete", "lesson-1");

        result.XpAwarded.Should().Be(100);
        result.TotalXp.Should().Be(100);

        var userXp = await _db.UserXp.FirstAsync(x => x.UserId == UserId);
        userXp.TotalXp.Should().Be(100);
        userXp.WeeklyXp.Should().Be(100);

        var events = await _db.XpEvents.Where(e => e.UserId == UserId).ToListAsync();
        events.Should().HaveCount(1);
        events[0].XpAmount.Should().Be(100);
        events[0].SourceType.Should().Be("lesson-complete");
        events[0].SourceId.Should().Be("lesson-1");
    }

    [Fact]
    public async Task AwardXp_MultipleAwards_Accumulates()
    {
        await _service.AwardXpAsync(UserId, 100, "lesson-complete", "l1");
        await _service.AwardXpAsync(UserId, 150, "lesson-complete", "l2");

        var userXp = await _db.UserXp.FirstAsync(x => x.UserId == UserId);
        userXp.TotalXp.Should().Be(250);
        userXp.WeeklyXp.Should().Be(250);

        var events = await _db.XpEvents.Where(e => e.UserId == UserId).ToListAsync();
        events.Should().HaveCount(2);
    }

    // ── Level-Up Detection ──

    [Fact]
    public async Task AwardXp_WhenCrossingLevelThreshold_ReturnsLevelUpInfo()
    {
        // Level 2 requires 200 XP. Award exactly 200 to trigger level-up.
        var result = await _service.AwardXpAsync(UserId, 200, "lesson-complete", "lesson-big");

        result.LevelUp.Should().NotBeNull();
        result.LevelUp!.PreviousLevel.Should().Be(1);
        result.LevelUp.NewLevel.Should().Be(2);
        result.LevelUp.PreviousRank.Should().Be("aspire-intern");
        result.LevelUp.NewRank.Should().Be("aspire-intern");
        result.CurrentLevel.Should().Be(2);
    }

    [Fact]
    public async Task AwardXp_WhenNotCrossingThreshold_ReturnsNullLevelUp()
    {
        var result = await _service.AwardXpAsync(UserId, 50, "lesson-complete", "small");

        result.LevelUp.Should().BeNull();
        result.CurrentLevel.Should().Be(1);
    }

    // ── Streak Tests ──

    [Fact]
    public async Task UpdateStreak_OnConsecutiveDays_IncrementsStreak()
    {
        var user = await _db.Users.FindAsync(UserId);
        user!.LastStreakDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1));
        user.LoginStreakDays = 3;
        await _db.SaveChangesAsync();

        await _service.UpdateStreakAsync(UserId);

        var updated = await _db.Users.FindAsync(UserId);
        updated!.LoginStreakDays.Should().Be(4);
        updated.LastStreakDate.Should().Be(DateOnly.FromDateTime(DateTime.UtcNow));
    }

    [Fact]
    public async Task UpdateStreak_AfterGap_ResetsToOne()
    {
        var user = await _db.Users.FindAsync(UserId);
        user!.LastStreakDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-5));
        user.LoginStreakDays = 10;
        await _db.SaveChangesAsync();

        await _service.UpdateStreakAsync(UserId);

        var updated = await _db.Users.FindAsync(UserId);
        updated!.LoginStreakDays.Should().Be(1);
    }

    [Fact]
    public async Task UpdateStreak_SameDay_DoesNotChange()
    {
        var user = await _db.Users.FindAsync(UserId);
        user!.LastStreakDate = DateOnly.FromDateTime(DateTime.UtcNow);
        user.LoginStreakDays = 5;
        await _db.SaveChangesAsync();

        await _service.UpdateStreakAsync(UserId);

        var updated = await _db.Users.FindAsync(UserId);
        updated!.LoginStreakDays.Should().Be(5);
    }

    [Fact]
    public async Task UpdateStreak_FirstTimeEver_SetsToOne()
    {
        var user = await _db.Users.FindAsync(UserId);
        user!.LastStreakDate = null;
        user.LoginStreakDays = 0;
        await _db.SaveChangesAsync();

        await _service.UpdateStreakAsync(UserId);

        var updated = await _db.Users.FindAsync(UserId);
        updated!.LoginStreakDays.Should().Be(1);
    }
}
