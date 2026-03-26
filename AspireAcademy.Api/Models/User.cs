using System.Text.Json;

namespace AspireAcademy.Api.Models;

public class User
{
    public Guid Id { get; set; }
    public string Username { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string DisplayName { get; set; } = null!;
    public string AvatarBase { get; set; } = "developer";
    public List<string> AvatarAccessories { get; set; } = [];
    public string AvatarBackground { get; set; } = "default";
    public string AvatarFrame { get; set; } = "none";
    public string? Bio { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    public int LoginStreakDays { get; set; }
    public DateOnly? LastStreakDate { get; set; }

    // Navigation properties
    public UserXp? Xp { get; set; }
    public ICollection<UserProgress> Progress { get; set; } = [];
    public ICollection<CodeSubmission> CodeSubmissions { get; set; } = [];
    public ICollection<UserAchievement> Achievements { get; set; } = [];
    public ICollection<XpEvent> XpEvents { get; set; } = [];
    public ICollection<Friendship> SentFriendRequests { get; set; } = [];
    public ICollection<Friendship> ReceivedFriendRequests { get; set; } = [];
}
