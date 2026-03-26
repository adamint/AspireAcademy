using System.Text.Json;

namespace AspireAcademy.Api.Models;

public class CodeSubmission
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public Guid ChallengeId { get; set; }
    public string SubmittedCode { get; set; } = null!;
    public bool CompilationSuccess { get; set; }
    public string? CompilationOutput { get; set; }
    public string? ExecutionOutput { get; set; }
    public JsonDocument TestResults { get; set; } = null!;
    public bool AllPassed { get; set; }
    public int? ExecutionTimeMs { get; set; }
    public DateTime SubmittedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public CodeChallenge Challenge { get; set; } = null!;
}
