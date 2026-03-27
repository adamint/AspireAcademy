using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AspireAcademy.Api.Migrations
{
    /// <inheritdoc />
    public partial class UpdateUserSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_friendships_no_self",
                table: "friendships");

            migrationBuilder.DropColumn(
                name: "AvatarAccessories",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AvatarBackground",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AvatarBase",
                table: "users");

            migrationBuilder.DropColumn(
                name: "AvatarFrame",
                table: "users");

            migrationBuilder.AddColumn<string>(
                name: "AvatarSeed",
                table: "users",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GitHubUsername",
                table: "users",
                type: "character varying(39)",
                maxLength: 39,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsDeleted",
                table: "users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Persona",
                table: "users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_friendships_no_self",
                table: "friendships",
                sql: "\"RequesterId\" != \"AddresseeId\"");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_friendships_no_self",
                table: "friendships");

            migrationBuilder.DropColumn(
                name: "AvatarSeed",
                table: "users");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "users");

            migrationBuilder.DropColumn(
                name: "GitHubUsername",
                table: "users");

            migrationBuilder.DropColumn(
                name: "IsDeleted",
                table: "users");

            migrationBuilder.DropColumn(
                name: "Persona",
                table: "users");

            migrationBuilder.AddColumn<string>(
                name: "AvatarAccessories",
                table: "users",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'[]'::jsonb");

            migrationBuilder.AddColumn<string>(
                name: "AvatarBackground",
                table: "users",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "default");

            migrationBuilder.AddColumn<string>(
                name: "AvatarBase",
                table: "users",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "developer");

            migrationBuilder.AddColumn<string>(
                name: "AvatarFrame",
                table: "users",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "none");

            migrationBuilder.AddCheckConstraint(
                name: "ck_friendships_no_self",
                table: "friendships",
                sql: "requester_id != addressee_id");
        }
    }
}
