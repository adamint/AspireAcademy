using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AspireAcademy.Api.Migrations
{
    /// <inheritdoc />
    public partial class SoftDeleteFilterAndDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateOnly>(
                name: "WeekStart",
                table: "user_xp",
                type: "date",
                nullable: false,
                defaultValueSql: "CURRENT_DATE",
                oldClrType: typeof(DateOnly),
                oldType: "date");

            // Prevent bidirectional duplicate friendships (A→B and B→A)
            migrationBuilder.Sql(
                """
                CREATE UNIQUE INDEX uq_friendships_bidirectional
                ON friendships (LEAST("RequesterId", "AddresseeId"), GREATEST("RequesterId", "AddresseeId"));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateOnly>(
                name: "WeekStart",
                table: "user_xp",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldDefaultValueSql: "CURRENT_DATE");

            migrationBuilder.Sql("DROP INDEX IF EXISTS uq_friendships_bidirectional;");
        }
    }
}
