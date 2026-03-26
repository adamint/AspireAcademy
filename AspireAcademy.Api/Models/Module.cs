namespace AspireAcademy.Api.Models;

public class Module
{
    public string Id { get; set; } = null!;
    public string WorldId { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Description { get; set; } = null!;
    public int SortOrder { get; set; }
    public string? UnlockAfterModuleId { get; set; }

    // Navigation
    public World World { get; set; } = null!;
    public Module? UnlockAfterModule { get; set; }
    public ICollection<Lesson> Lessons { get; set; } = [];
}
