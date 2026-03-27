using AspireAcademy.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

public static class SearchEndpoints
{
    private const int MaxResults = 15;

    private static readonly List<StaticPageResult> StaticPages =
    [
        new("Dashboard", "Your learning dashboard", "/dashboard", "📊"),
        new("Profile", "View and edit your profile", "/profile", "👤"),
        new("Leaderboard", "See top learners", "/leaderboard", "🏆"),
        new("Friends", "Manage your friends", "/friends", "👥"),
        new("Achievements", "View your achievements", "/achievements", "🏅"),
    ];

    public static WebApplication MapSearchEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api").WithTags("Search").RequireAuthorization();
        group.MapGet("/search", Search);
        return app;
    }

    private static async Task<IResult> Search(string? q, AcademyDbContext db)
    {
        var query = q?.Trim() ?? string.Empty;

        if (query.Length == 0)
        {
            return Results.Ok(new SearchResponse([]));
        }

        var results = new List<SearchResultDto>();

        // Search static pages (client-safe, no DB hit)
        foreach (var page in StaticPages)
        {
            if (page.Title.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                page.Description.Contains(query, StringComparison.OrdinalIgnoreCase))
            {
                results.Add(new SearchResultDto("page", page.Title, page.Description, page.Url, page.Icon));
            }
        }

        var lowerQuery = query.ToLowerInvariant();

        // Search worlds
        var worlds = await db.Worlds
            .Where(w => w.Name.ToLower().Contains(lowerQuery) ||
                        w.Description.ToLower().Contains(lowerQuery))
            .OrderBy(w => w.SortOrder)
            .Take(MaxResults)
            .Select(w => new SearchResultDto("world", w.Name, w.Description, $"/worlds/{w.Id}", w.Icon))
            .ToListAsync();

        results.AddRange(worlds);

        // Search modules (include world info for URL)
        var modules = await db.Modules
            .Where(m => m.Name.ToLower().Contains(lowerQuery) ||
                        m.Description.ToLower().Contains(lowerQuery))
            .OrderBy(m => m.SortOrder)
            .Take(MaxResults)
            .Select(m => new SearchResultDto("module", m.Name, m.Description, $"/worlds/{m.WorldId}", "📦"))
            .ToListAsync();

        results.AddRange(modules);

        // Search lessons
        var lessons = await db.Lessons
            .Where(l => l.Title.ToLower().Contains(lowerQuery) ||
                        l.Description.ToLower().Contains(lowerQuery))
            .OrderBy(l => l.SortOrder)
            .Take(MaxResults)
            .Select(l => new SearchResultDto("lesson", l.Title, l.Description, $"/lessons/{l.Id}", "📖"))
            .ToListAsync();

        results.AddRange(lessons);

        // Deduplicate by URL and limit
        var limited = results
            .GroupBy(r => r.Url)
            .Select(g => g.First())
            .Take(MaxResults)
            .ToList();

        return Results.Ok(new SearchResponse(limited));
    }

    private record StaticPageResult(string Title, string Description, string Url, string Icon);
}

public record SearchResponse(List<SearchResultDto> Results);

public record SearchResultDto(string Type, string Title, string Description, string Url, string Icon);
