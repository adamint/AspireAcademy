namespace AspireAcademy.Api.Models;

public class UserAchievement
{
    public Guid UserId { get; set; }
    public string AchievementId { get; set; } = null!;
    public DateTime UnlockedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public Achievement Achievement { get; set; } = null!;
}
