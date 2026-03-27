using System;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AspireAcademy.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddQuizAttempts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "quiz_attempts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false, defaultValueSql: "gen_random_uuid()"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LessonId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
                    MaxScore = table.Column<int>(type: "integer", nullable: false, defaultValue: 100),
                    Passed = table.Column<bool>(type: "boolean", nullable: false),
                    IsPerfect = table.Column<bool>(type: "boolean", nullable: false),
                    XpEarned = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    BonusXpEarned = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    AttemptNumber = table.Column<int>(type: "integer", nullable: false),
                    Results = table.Column<JsonDocument>(type: "jsonb", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_quiz_attempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_quiz_attempts_lessons_LessonId",
                        column: x => x.LessonId,
                        principalTable: "lessons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_quiz_attempts_users_UserId",
                        column: x => x.UserId,
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_quiz_attempts_completed_at",
                table: "quiz_attempts",
                column: "CompletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_quiz_attempts_LessonId",
                table: "quiz_attempts",
                column: "LessonId");

            migrationBuilder.CreateIndex(
                name: "ix_quiz_attempts_user_lesson",
                table: "quiz_attempts",
                columns: new[] { "UserId", "LessonId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "quiz_attempts");
        }
    }
}
