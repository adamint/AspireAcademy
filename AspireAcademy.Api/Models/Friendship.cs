namespace AspireAcademy.Api.Models;

public class Friendship
{
    public Guid Id { get; set; }
    public Guid RequesterId { get; set; }
    public Guid AddresseeId { get; set; }
    public string Status { get; set; } = "pending";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AcceptedAt { get; set; }

    // Navigation
    public User Requester { get; set; } = null!;
    public User Addressee { get; set; } = null!;
}
