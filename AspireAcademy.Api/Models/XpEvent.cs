namespace AspireAcademy.Api.Models;

public class XpEvent
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public int XpAmount { get; set; }
    public string SourceType { get; set; } = null!;
    public string? SourceId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
}
