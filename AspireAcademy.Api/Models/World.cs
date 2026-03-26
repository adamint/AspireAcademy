namespace AspireAcademy.Api.Models;

public class World
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string Icon { get; set; } = null!;
    public int SortOrder { get; set; }
    public int LevelRangeStart { get; set; }
    public int LevelRangeEnd { get; set; }
    public string? UnlockAfterWorldId { get; set; }

    // Navigation
    public World? UnlockAfterWorld { get; set; }
    public ICollection<Module> Modules { get; set; } = [];
}
