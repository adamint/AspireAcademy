using System.Text.Json;

namespace AspireAcademy.Api.Models;

public class QuizQuestion
{
    public Guid Id { get; set; }
    public string LessonId { get; set; } = null!;
    public string QuestionText { get; set; } = null!;
    public string QuestionType { get; set; } = null!;
    public JsonDocument Options { get; set; } = null!;
    public string Explanation { get; set; } = null!;
    public string? CodeSnippet { get; set; }
    public int SortOrder { get; set; }
    public int Points { get; set; } = 10;

    // Navigation
    public Lesson Lesson { get; set; } = null!;
}
