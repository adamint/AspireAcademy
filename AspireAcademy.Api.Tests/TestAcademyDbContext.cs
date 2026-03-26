using System.Text.Json;
using AspireAcademy.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace AspireAcademy.Api.Tests;

/// <summary>
/// DbContext derived from AcademyDbContext that adds value converters
/// for JsonDocument and List&lt;string&gt; to work with InMemory provider.
/// </summary>
public class TestAcademyDbContext(DbContextOptions<AcademyDbContext> options) : AcademyDbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var jsonDocConverter = new ValueConverter<JsonDocument, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonDocument.Parse(v, default));

        var jsonDocComparer = new ValueComparer<JsonDocument>(
            (a, b) => JsonDocEquals(a, b),
            v => v.RootElement.GetRawText().GetHashCode(),
            v => JsonDocument.Parse(v.RootElement.GetRawText(), default));

        var listStringConverter = new ValueConverter<List<string>, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>());

        var listStringComparer = new ValueComparer<List<string>>(
            (a, b) => a != null && b != null && a.SequenceEqual(b),
            v => v.Aggregate(0, (a, b) => HashCode.Combine(a, b.GetHashCode())),
            v => v.ToList());

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            // Remove Postgres-specific check constraints
            foreach (var check in entityType.GetCheckConstraints().ToList())
            {
                entityType.RemoveCheckConstraint(check.ModelName);
            }

            foreach (var property in entityType.GetProperties())
            {
                // Remove Postgres column types
                if (property.GetColumnType() == "jsonb")
                {
                    property.SetColumnType(null);
                }

                // Replace Postgres default SQL expressions with null (we set values explicitly)
                var defaultSql = property.GetDefaultValueSql();
                if (defaultSql is not null && (
                    defaultSql.Contains("gen_random_uuid") ||
                    defaultSql.Contains("now()") ||
                    defaultSql.Contains("::jsonb")))
                {
                    property.SetDefaultValueSql(null);
                }

                if (property.ClrType == typeof(JsonDocument))
                {
                    property.SetValueConverter(jsonDocConverter);
                    property.SetValueComparer(jsonDocComparer);
                }
                else if (property.ClrType == typeof(List<string>))
                {
                    property.SetValueConverter(listStringConverter);
                    property.SetValueComparer(listStringComparer);
                }
            }
        }
    }

    private static bool JsonDocEquals(JsonDocument? a, JsonDocument? b)
    {
        if (a is null && b is null) return true;
        if (a is null || b is null) return false;
        return a.RootElement.GetRawText() == b.RootElement.GetRawText();
    }
}
