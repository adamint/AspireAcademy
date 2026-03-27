using System.Text.Json;

namespace AspireAcademy.Api.Models;

public class QuizAttempt
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string LessonId { get; set; } = null!;
    public int Score { get; set; }
    public int MaxScore { get; set; } = 100;
    public bool Passed { get; set; }
    public bool IsPerfect { get; set; }
    public int XpEarned { get; set; }
    public int BonusXpEarned { get; set; }
    public int AttemptNumber { get; set; }
    public JsonDocument Results { get; set; } = null!;
    public DateTime CompletedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public Lesson Lesson { get; set; } = null!;
}
