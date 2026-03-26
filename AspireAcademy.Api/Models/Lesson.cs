namespace AspireAcademy.Api.Models;

public class Lesson
{
    public string Id { get; set; } = null!;
    public string ModuleId { get; set; } = null!;
    public string Title { get; set; } = null!;
    public string Description { get; set; } = null!;
    public string Type { get; set; } = null!;
    public int SortOrder { get; set; }
    public string ContentMarkdown { get; set; } = null!;
    public int XpReward { get; set; }
    public int BonusXp { get; set; }
    public int EstimatedMinutes { get; set; }
    public string? UnlockAfterLessonId { get; set; }
    public bool IsBoss { get; set; }

    // Navigation
    public Module Module { get; set; } = null!;
    public Lesson? UnlockAfterLesson { get; set; }
    public ICollection<QuizQuestion> QuizQuestions { get; set; } = [];
    public ICollection<CodeChallenge> CodeChallenges { get; set; } = [];
    public ICollection<UserProgress> UserProgress { get; set; } = [];
}
