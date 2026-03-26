using System;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AspireAcademy.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "achievements",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    Icon = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Category = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    TriggerType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    TriggerConfig = table.Column<JsonDocument>(type: "jsonb", nullable: false),
                    XpReward = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Rarity = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_achievements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    Username = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Email = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    PasswordHash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    DisplayName = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    AvatarBase = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "developer"),
                    AvatarAccessories = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    AvatarBackground = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "default"),
                    AvatarFrame = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "none"),
                    Bio = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    LastLoginAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LoginStreakDays = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    LastStreakDate = table.Column<DateOnly>(type: "date", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "worlds",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Icon = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    LevelRangeStart = table.Column<int>(type: "integer", nullable: false),
                    LevelRangeEnd = table.Column<int>(type: "integer", nullable: false),
                    UnlockAfterWorldId = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_worlds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_worlds_worlds_UnlockAfterWorldId",
                        column: x => x.UnlockAfterWorldId,
                        principalTable: "worlds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "friendships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    RequesterId = table.Column<Guid>(type: "uuid", nullable: false),
                    AddresseeId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "pending"),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    AcceptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_friendships", x => x.Id);
                    table.CheckConstraint("ck_friendships_no_self", "requester_id != addressee_id");
                    table.ForeignKey(
                        name: "FK_friendships_users_AddresseeId",
                        column: x => x.AddresseeId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_friendships_users_RequesterId",
                        column: x => x.RequesterId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_achievements",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AchievementId = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    UnlockedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_achievements", x => new { x.UserId, x.AchievementId });
                    table.ForeignKey(
                        name: "FK_user_achievements_achievements_AchievementId",
                        column: x => x.AchievementId,
                        principalTable: "achievements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_achievements_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_xp",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TotalXp = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CurrentLevel = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    CurrentRank = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false, defaultValue: "aspire-intern"),
                    WeeklyXp = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    WeekStart = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_xp", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_user_xp_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "xp_events",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    XpAmount = table.Column<int>(type: "integer", nullable: false),
                    SourceType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    SourceId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_xp_events", x => x.Id);
                    table.ForeignKey(
                        name: "FK_xp_events_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "modules",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    WorldId = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    UnlockAfterModuleId = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_modules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_modules_modules_UnlockAfterModuleId",
                        column: x => x.UnlockAfterModuleId,
                        principalTable: "modules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_modules_worlds_WorldId",
                        column: x => x.WorldId,
                        principalTable: "worlds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "lessons",
                columns: table => new
                {
                    Id = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    ModuleId = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Title = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    Type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    ContentMarkdown = table.Column<string>(type: "text", nullable: false),
                    XpReward = table.Column<int>(type: "integer", nullable: false),
                    BonusXp = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    EstimatedMinutes = table.Column<int>(type: "integer", nullable: false),
                    UnlockAfterLessonId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IsBoss = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lessons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_lessons_lessons_UnlockAfterLessonId",
                        column: x => x.UnlockAfterLessonId,
                        principalTable: "lessons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_lessons_modules_ModuleId",
                        column: x => x.ModuleId,
                        principalTable: "modules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "code_challenges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    LessonId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    InstructionsMarkdown = table.Column<string>(type: "text", nullable: false),
                    StarterCode = table.Column<string>(type: "text", nullable: false),
                    SolutionCode = table.Column<string>(type: "text", nullable: false),
                    TestCases = table.Column<JsonDocument>(type: "jsonb", nullable: false),
                    Hints = table.Column<JsonDocument>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    RequiredPackages = table.Column<JsonDocument>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    SortOrder = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    StepTitle = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_code_challenges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_code_challenges_lessons_LessonId",
                        column: x => x.LessonId,
                        principalTable: "lessons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "quiz_questions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    LessonId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    QuestionText = table.Column<string>(type: "text", nullable: false),
                    QuestionType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Options = table.Column<JsonDocument>(type: "jsonb", nullable: false),
                    Explanation = table.Column<string>(type: "text", nullable: false),
                    CodeSnippet = table.Column<string>(type: "text", nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Points = table.Column<int>(type: "integer", nullable: false, defaultValue: 10)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_quiz_questions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_quiz_questions_lessons_LessonId",
                        column: x => x.LessonId,
                        principalTable: "lessons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "user_progress",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LessonId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "not-started"),
                    Score = table.Column<int>(type: "integer", nullable: true),
                    MaxScore = table.Column<int>(type: "integer", nullable: true),
                    Attempts = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    XpEarned = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    StartedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user_progress", x => x.Id);
                    table.ForeignKey(
                        name: "FK_user_progress_lessons_LessonId",
                        column: x => x.LessonId,
                        principalTable: "lessons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_user_progress_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "code_submissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChallengeId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittedCode = table.Column<string>(type: "text", nullable: false),
                    CompilationSuccess = table.Column<bool>(type: "boolean", nullable: false),
                    CompilationOutput = table.Column<string>(type: "text", nullable: true),
                    ExecutionOutput = table.Column<string>(type: "text", nullable: true),
                    TestResults = table.Column<JsonDocument>(type: "jsonb", nullable: false),
                    AllPassed = table.Column<bool>(type: "boolean", nullable: false),
                    ExecutionTimeMs = table.Column<int>(type: "integer", nullable: true),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_code_submissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_code_submissions_code_challenges_ChallengeId",
                        column: x => x.ChallengeId,
                        principalTable: "code_challenges",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_code_submissions_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_code_challenges_lesson_id",
                table: "code_challenges",
                column: "LessonId");

            migrationBuilder.CreateIndex(
                name: "IX_code_submissions_ChallengeId",
                table: "code_submissions",
                column: "ChallengeId");

            migrationBuilder.CreateIndex(
                name: "ix_code_submissions_user_challenge",
                table: "code_submissions",
                columns: new[] { "UserId", "ChallengeId" });

            migrationBuilder.CreateIndex(
                name: "ix_friendships_addressee",
                table: "friendships",
                column: "AddresseeId");

            migrationBuilder.CreateIndex(
                name: "ix_friendships_requester",
                table: "friendships",
                column: "RequesterId");

            migrationBuilder.CreateIndex(
                name: "uq_friendships_pair",
                table: "friendships",
                columns: new[] { "RequesterId", "AddresseeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_lessons_module_id",
                table: "lessons",
                column: "ModuleId");

            migrationBuilder.CreateIndex(
                name: "IX_lessons_UnlockAfterLessonId",
                table: "lessons",
                column: "UnlockAfterLessonId");

            migrationBuilder.CreateIndex(
                name: "IX_modules_UnlockAfterModuleId",
                table: "modules",
                column: "UnlockAfterModuleId");

            migrationBuilder.CreateIndex(
                name: "ix_modules_world_id",
                table: "modules",
                column: "WorldId");

            migrationBuilder.CreateIndex(
                name: "ix_quiz_questions_lesson_id",
                table: "quiz_questions",
                column: "LessonId");

            migrationBuilder.CreateIndex(
                name: "IX_user_achievements_AchievementId",
                table: "user_achievements",
                column: "AchievementId");

            migrationBuilder.CreateIndex(
                name: "ix_user_achievements_user_id",
                table: "user_achievements",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "ix_user_progress_lesson_id",
                table: "user_progress",
                column: "LessonId");

            migrationBuilder.CreateIndex(
                name: "ix_user_progress_user_id",
                table: "user_progress",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "uq_user_progress_user_lesson",
                table: "user_progress",
                columns: new[] { "UserId", "LessonId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_email",
                table: "users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_users_username",
                table: "users",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_worlds_UnlockAfterWorldId",
                table: "worlds",
                column: "UnlockAfterWorldId");

            migrationBuilder.CreateIndex(
                name: "ix_xp_events_created_at",
                table: "xp_events",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "ix_xp_events_user_id",
                table: "xp_events",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "code_submissions");

            migrationBuilder.DropTable(
                name: "friendships");

            migrationBuilder.DropTable(
                name: "quiz_questions");

            migrationBuilder.DropTable(
                name: "user_achievements");

            migrationBuilder.DropTable(
                name: "user_progress");

            migrationBuilder.DropTable(
                name: "user_xp");

            migrationBuilder.DropTable(
                name: "xp_events");

            migrationBuilder.DropTable(
                name: "code_challenges");

            migrationBuilder.DropTable(
                name: "achievements");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropTable(
                name: "lessons");

            migrationBuilder.DropTable(
                name: "modules");

            migrationBuilder.DropTable(
                name: "worlds");
        }
    }
}
