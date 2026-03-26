using System.Text.Json;

namespace AspireAcademy.Api.Models;

public class Achievement
{
    public string Id { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string Icon { get; set; } = null!;
    public string Category { get; set; } = null!;
    public string TriggerType { get; set; } = null!;
    public JsonDocument TriggerConfig { get; set; } = null!;
    public int XpReward { get; set; }
    public int SortOrder { get; set; }
    public string Rarity { get; set; } = null!;

    // Navigation
    public ICollection<UserAchievement> UserAchievements { get; set; } = [];
}
