using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace AspireAcademy.Api.Data;

/// <summary>
/// Factory used by EF Core CLI tools (dotnet ef migrations add/update) at design time.
/// Uses a dummy connection string — no real database connection is needed for migration scaffolding.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AcademyDbContext>
{
    public AcademyDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AcademyDbContext>();
        optionsBuilder.UseNpgsql("Host=localhost;Database=design_time_db");
        return new AcademyDbContext(optionsBuilder.Options);
    }
}
