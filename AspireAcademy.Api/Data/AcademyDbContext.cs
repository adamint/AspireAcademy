using System.Text.Json;
using AspireAcademy.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Data;

public class AcademyDbContext(DbContextOptions<AcademyDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<UserXp> UserXp => Set<UserXp>();
    public DbSet<World> Worlds => Set<World>();
    public DbSet<Module> Modules => Set<Module>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<QuizQuestion> QuizQuestions => Set<QuizQuestion>();
    public DbSet<CodeChallenge> CodeChallenges => Set<CodeChallenge>();
    public DbSet<UserProgress> UserProgress => Set<UserProgress>();
    public DbSet<CodeSubmission> CodeSubmissions => Set<CodeSubmission>();
    public DbSet<Achievement> Achievements => Set<Achievement>();
    public DbSet<UserAchievement> UserAchievements => Set<UserAchievement>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<XpEvent> XpEvents => Set<XpEvent>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Users ──
        modelBuilder.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(u => u.Id);
            e.Property(u => u.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(u => u.Username).HasMaxLength(30).IsRequired();
            e.Property(u => u.Email).HasMaxLength(255).IsRequired();
            e.Property(u => u.PasswordHash).HasMaxLength(255).IsRequired();
            e.Property(u => u.DisplayName).HasMaxLength(50).IsRequired();
            e.Property(u => u.AvatarSeed).HasMaxLength(50);
            e.Property(u => u.Bio).HasMaxLength(200);
            e.Property(u => u.GitHubUsername).HasMaxLength(39);
            e.Property(u => u.Persona).HasMaxLength(20);
            e.Property(u => u.CreatedAt).HasDefaultValueSql("now()").IsRequired();
            e.Property(u => u.LoginStreakDays).HasDefaultValue(0).IsRequired();

            e.HasIndex(u => u.Username).IsUnique().HasDatabaseName("ix_users_username");
            e.HasIndex(u => u.Email).IsUnique().HasDatabaseName("ix_users_email");

            e.HasQueryFilter(u => !u.IsDeleted);
        });

        // ── UserXp ──
        modelBuilder.Entity<UserXp>(e =>
        {
            e.ToTable("user_xp");
            e.HasKey(x => x.UserId);
            e.Property(x => x.TotalXp).HasDefaultValue(0).IsRequired();
            e.Property(x => x.CurrentLevel).HasDefaultValue(1).IsRequired();
            e.Property(x => x.CurrentRank).HasMaxLength(30).HasDefaultValue(Ranks.AspireIntern).IsRequired();
            e.Property(x => x.WeeklyXp).HasDefaultValue(0).IsRequired();
            e.Property(x => x.WeekStart).HasDefaultValueSql("CURRENT_DATE").IsRequired();

            e.HasOne(x => x.User)
                .WithOne(u => u.Xp)
                .HasForeignKey<UserXp>(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Worlds ──
        modelBuilder.Entity<World>(e =>
        {
            e.ToTable("worlds");
            e.HasKey(w => w.Id);
            e.Property(w => w.Id).HasMaxLength(20);
            e.Property(w => w.Name).HasMaxLength(100).IsRequired();
            e.Property(w => w.Description).IsRequired();
            e.Property(w => w.Icon).HasMaxLength(10).IsRequired();
            e.Property(w => w.SortOrder).IsRequired();
            e.Property(w => w.LevelRangeStart).IsRequired();
            e.Property(w => w.LevelRangeEnd).IsRequired();
            e.Property(w => w.UnlockAfterWorldId).HasMaxLength(20);

            e.HasOne(w => w.UnlockAfterWorld)
                .WithMany()
                .HasForeignKey(w => w.UnlockAfterWorldId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // ── Modules ──
        modelBuilder.Entity<Module>(e =>
        {
            e.ToTable("modules");
            e.HasKey(m => m.Id);
            e.Property(m => m.Id).HasMaxLength(30);
            e.Property(m => m.WorldId).HasMaxLength(20).IsRequired();
            e.Property(m => m.Name).HasMaxLength(100).IsRequired();
            e.Property(m => m.Description).IsRequired();
            e.Property(m => m.SortOrder).IsRequired();
            e.Property(m => m.UnlockAfterModuleId).HasMaxLength(30);

            e.HasOne(m => m.World)
                .WithMany(w => w.Modules)
                .HasForeignKey(m => m.WorldId);

            e.HasOne(m => m.UnlockAfterModule)
                .WithMany()
                .HasForeignKey(m => m.UnlockAfterModuleId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(m => m.WorldId).HasDatabaseName("ix_modules_world_id");
        });

        // ── Lessons ──
        modelBuilder.Entity<Lesson>(e =>
        {
            e.ToTable("lessons");
            e.HasKey(l => l.Id);
            e.Property(l => l.Id).HasMaxLength(50);
            e.Property(l => l.ModuleId).HasMaxLength(30).IsRequired();
            e.Property(l => l.Title).HasMaxLength(150).IsRequired();
            e.Property(l => l.Description).IsRequired();
            e.Property(l => l.Type).HasMaxLength(20).IsRequired();
            e.Property(l => l.SortOrder).IsRequired();
            e.Property(l => l.ContentMarkdown).IsRequired();
            e.Property(l => l.XpReward).IsRequired();
            e.Property(l => l.BonusXp).HasDefaultValue(0).IsRequired();
            e.Property(l => l.EstimatedMinutes).IsRequired();
            e.Property(l => l.UnlockAfterLessonId).HasMaxLength(50);
            e.Property(l => l.IsBoss).HasDefaultValue(false).IsRequired();
            e.Ignore(l => l.PersonaRelevance);

            e.HasOne(l => l.Module)
                .WithMany(m => m.Lessons)
                .HasForeignKey(l => l.ModuleId);

            e.HasOne(l => l.UnlockAfterLesson)
                .WithMany()
                .HasForeignKey(l => l.UnlockAfterLessonId)
                .OnDelete(DeleteBehavior.SetNull);

            e.HasIndex(l => l.ModuleId).HasDatabaseName("ix_lessons_module_id");
        });

        // ── QuizQuestions ──
        modelBuilder.Entity<QuizQuestion>(e =>
        {
            e.ToTable("quiz_questions");
            e.HasKey(q => q.Id);
            e.Property(q => q.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(q => q.LessonId).HasMaxLength(50).IsRequired();
            e.Property(q => q.QuestionText).IsRequired();
            e.Property(q => q.QuestionType).HasMaxLength(20).IsRequired();
            e.Property(q => q.Options).HasColumnType("jsonb").IsRequired();
            e.Property(q => q.Explanation).IsRequired();
            e.Property(q => q.SortOrder).IsRequired();
            e.Property(q => q.Points).HasDefaultValue(10).IsRequired();

            e.HasOne(q => q.Lesson)
                .WithMany(l => l.QuizQuestions)
                .HasForeignKey(q => q.LessonId);

            e.HasIndex(q => q.LessonId).HasDatabaseName("ix_quiz_questions_lesson_id");
        });

        // ── CodeChallenges ──
        modelBuilder.Entity<CodeChallenge>(e =>
        {
            e.ToTable("code_challenges");
            e.HasKey(c => c.Id);
            e.Property(c => c.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(c => c.LessonId).HasMaxLength(50).IsRequired();
            e.Property(c => c.InstructionsMarkdown).IsRequired();
            e.Property(c => c.StarterCode).IsRequired();
            e.Property(c => c.SolutionCode).IsRequired();
            e.Property(c => c.TestCases).HasColumnType("jsonb").IsRequired();
            e.Property(c => c.Hints).HasColumnType("jsonb").HasDefaultValueSql("'[]'::jsonb").IsRequired();
            e.Property(c => c.RequiredPackages).HasColumnType("jsonb").HasDefaultValueSql("'[]'::jsonb").IsRequired();
            e.Property(c => c.SortOrder).HasDefaultValue(0).IsRequired();
            e.Property(c => c.StepTitle).HasMaxLength(100);

            e.HasOne(c => c.Lesson)
                .WithMany(l => l.CodeChallenges)
                .HasForeignKey(c => c.LessonId);

            e.HasIndex(c => c.LessonId).HasDatabaseName("ix_code_challenges_lesson_id");
        });

        // ── UserProgress ──
        modelBuilder.Entity<UserProgress>(e =>
        {
            e.ToTable("user_progress");
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(p => p.UserId).IsRequired();
            e.Property(p => p.LessonId).HasMaxLength(50).IsRequired();
            e.Property(p => p.Status).HasMaxLength(20).HasDefaultValue(ProgressStatuses.NotStarted).IsRequired();
            e.Property(p => p.Attempts).HasDefaultValue(0).IsRequired();
            e.Property(p => p.XpEarned).HasDefaultValue(0).IsRequired();

            e.HasOne(p => p.User)
                .WithMany(u => u.Progress)
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(p => p.Lesson)
                .WithMany(l => l.UserProgress)
                .HasForeignKey(p => p.LessonId);

            e.HasIndex(p => new { p.UserId, p.LessonId })
                .IsUnique()
                .HasDatabaseName("uq_user_progress_user_lesson");

            e.HasIndex(p => p.UserId).HasDatabaseName("ix_user_progress_user_id");
            e.HasIndex(p => p.LessonId).HasDatabaseName("ix_user_progress_lesson_id");
        });

        // ── CodeSubmissions ──
        modelBuilder.Entity<CodeSubmission>(e =>
        {
            e.ToTable("code_submissions");
            e.HasKey(s => s.Id);
            e.Property(s => s.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(s => s.UserId).IsRequired();
            e.Property(s => s.ChallengeId).IsRequired();
            e.Property(s => s.SubmittedCode).IsRequired();
            e.Property(s => s.CompilationSuccess).IsRequired();
            e.Property(s => s.TestResults).HasColumnType("jsonb").IsRequired();
            e.Property(s => s.AllPassed).IsRequired();
            e.Property(s => s.SubmittedAt).HasDefaultValueSql("now()").IsRequired();

            e.HasOne(s => s.User)
                .WithMany(u => u.CodeSubmissions)
                .HasForeignKey(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(s => s.Challenge)
                .WithMany(c => c.Submissions)
                .HasForeignKey(s => s.ChallengeId);

            e.HasIndex(s => new { s.UserId, s.ChallengeId })
                .HasDatabaseName("ix_code_submissions_user_challenge");
        });

        // ── Achievements ──
        modelBuilder.Entity<Achievement>(e =>
        {
            e.ToTable("achievements");
            e.HasKey(a => a.Id);
            e.Property(a => a.Id).HasMaxLength(40);
            e.Property(a => a.Name).HasMaxLength(100).IsRequired();
            e.Property(a => a.Description).HasMaxLength(255).IsRequired();
            e.Property(a => a.Icon).HasMaxLength(10).IsRequired();
            e.Property(a => a.Category).HasMaxLength(30).IsRequired();
            e.Property(a => a.TriggerType).HasMaxLength(30).IsRequired();
            e.Property(a => a.TriggerConfig).HasColumnType("jsonb").IsRequired();
            e.Property(a => a.XpReward).HasDefaultValue(0).IsRequired();
            e.Property(a => a.SortOrder).IsRequired();
            e.Property(a => a.Rarity).HasMaxLength(20).IsRequired();
        });

        // ── UserAchievements ──
        modelBuilder.Entity<UserAchievement>(e =>
        {
            e.ToTable("user_achievements");
            e.HasKey(ua => new { ua.UserId, ua.AchievementId });
            e.Property(ua => ua.AchievementId).HasMaxLength(40);
            e.Property(ua => ua.UnlockedAt).HasDefaultValueSql("now()").IsRequired();

            e.HasOne(ua => ua.User)
                .WithMany(u => u.Achievements)
                .HasForeignKey(ua => ua.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(ua => ua.Achievement)
                .WithMany(a => a.UserAchievements)
                .HasForeignKey(ua => ua.AchievementId);

            e.HasIndex(ua => ua.UserId).HasDatabaseName("ix_user_achievements_user_id");
        });

        // ── Friendships ──
        modelBuilder.Entity<Friendship>(e =>
        {
            e.ToTable("friendships");
            e.HasKey(f => f.Id);
            e.Property(f => f.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(f => f.RequesterId).IsRequired();
            e.Property(f => f.AddresseeId).IsRequired();
            e.Property(f => f.Status).HasMaxLength(20).HasDefaultValue(FriendshipStatuses.Pending).IsRequired();
            e.Property(f => f.CreatedAt).HasDefaultValueSql("now()").IsRequired();

            e.HasOne(f => f.Requester)
                .WithMany(u => u.SentFriendRequests)
                .HasForeignKey(f => f.RequesterId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(f => f.Addressee)
                .WithMany(u => u.ReceivedFriendRequests)
                .HasForeignKey(f => f.AddresseeId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(f => new { f.RequesterId, f.AddresseeId })
                .IsUnique()
                .HasDatabaseName("uq_friendships_pair");

            e.HasIndex(f => f.RequesterId).HasDatabaseName("ix_friendships_requester");
            e.HasIndex(f => f.AddresseeId).HasDatabaseName("ix_friendships_addressee");

            e.ToTable(t => t.HasCheckConstraint("ck_friendships_no_self", "\"RequesterId\" != \"AddresseeId\""));
        });

        // ── XpEvents ──
        modelBuilder.Entity<XpEvent>(e =>
        {
            e.ToTable("xp_events");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.UserId).IsRequired();
            e.Property(x => x.XpAmount).IsRequired();
            e.Property(x => x.SourceType).HasMaxLength(30).IsRequired();
            e.Property(x => x.SourceId).HasMaxLength(50);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()").IsRequired();

            e.HasOne(x => x.User)
                .WithMany(u => u.XpEvents)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasIndex(x => x.UserId).HasDatabaseName("ix_xp_events_user_id");
            e.HasIndex(x => x.CreatedAt).HasDatabaseName("ix_xp_events_created_at");
        });

        // ── QuizAttempts ──
        modelBuilder.Entity<QuizAttempt>(e =>
        {
            e.ToTable("quiz_attempts");
            e.HasKey(a => a.Id);
            e.Property(a => a.Id).HasDefaultValueSql("gen_random_uuid()");
            e.Property(a => a.UserId).IsRequired();
            e.Property(a => a.LessonId).HasMaxLength(50).IsRequired();
            e.Property(a => a.Score).IsRequired();
            e.Property(a => a.MaxScore).HasDefaultValue(100).IsRequired();
            e.Property(a => a.Passed).IsRequired();
            e.Property(a => a.IsPerfect).IsRequired();
            e.Property(a => a.XpEarned).HasDefaultValue(0).IsRequired();
            e.Property(a => a.BonusXpEarned).HasDefaultValue(0).IsRequired();
            e.Property(a => a.AttemptNumber).IsRequired();
            e.Property(a => a.Results).HasColumnType("jsonb").IsRequired();
            e.Property(a => a.CompletedAt).HasDefaultValueSql("now()").IsRequired();

            e.HasOne(a => a.User)
                .WithMany(u => u.QuizAttempts)
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(a => a.Lesson)
                .WithMany(l => l.QuizAttempts)
                .HasForeignKey(a => a.LessonId);

            e.HasIndex(a => new { a.UserId, a.LessonId }).HasDatabaseName("ix_quiz_attempts_user_lesson");
            e.HasIndex(a => a.CompletedAt).HasDatabaseName("ix_quiz_attempts_completed_at");
        });
    }
}
