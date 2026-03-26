using System.Text.Json;

namespace AspireAcademy.Api.Models;

public class CodeChallenge
{
    public Guid Id { get; set; }
    public string LessonId { get; set; } = null!;
    public string InstructionsMarkdown { get; set; } = null!;
    public string StarterCode { get; set; } = null!;
    public string SolutionCode { get; set; } = null!;
    public JsonDocument TestCases { get; set; } = null!;
    public JsonDocument Hints { get; set; } = null!;
    public JsonDocument RequiredPackages { get; set; } = null!;
    public int SortOrder { get; set; }
    public string? StepTitle { get; set; }

    // Navigation
    public Lesson Lesson { get; set; } = null!;
    public ICollection<CodeSubmission> Submissions { get; set; } = [];
}
