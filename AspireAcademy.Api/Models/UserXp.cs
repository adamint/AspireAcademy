namespace AspireAcademy.Api.Models;

public class UserXp
{
    public Guid UserId { get; set; }
    public int TotalXp { get; set; }
    public int CurrentLevel { get; set; } = 1;
    public string CurrentRank { get; set; } = "aspire-intern";
    public int WeeklyXp { get; set; }
    public DateOnly WeekStart { get; set; }

    // Navigation
    public User User { get; set; } = null!;
}
