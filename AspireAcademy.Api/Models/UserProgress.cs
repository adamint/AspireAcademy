namespace AspireAcademy.Api.Models;

public class UserProgress
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string LessonId { get; set; } = null!;
    public string Status { get; set; } = "not-started";
    public int? Score { get; set; }
    public int? MaxScore { get; set; }
    public int Attempts { get; set; }
    public int XpEarned { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime? StartedAt { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public Lesson Lesson { get; set; } = null!;
}
