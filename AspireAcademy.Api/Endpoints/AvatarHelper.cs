using System.Security.Cryptography;
using System.Text;

namespace AspireAcademy.Api.Endpoints;

internal static class AvatarHelper
{
    internal static string GetAvatarUrl(string? avatarSeed, string email, string? gitHubUsername = null)
    {
        if (!string.IsNullOrWhiteSpace(gitHubUsername))
        {
            return $"https://github.com/{Uri.EscapeDataString(gitHubUsername)}.png";
        }

        if (avatarSeed is not null)
        {
            return $"https://api.dicebear.com/9.x/pixel-art/svg?seed={Uri.EscapeDataString(avatarSeed)}";
        }

        var emailHash = ComputeHash(email.Trim().ToLowerInvariant());
        return $"https://gravatar.com/avatar/{emailHash}?d=retro&s=128";
    }

    private static string ComputeHash(string input)
    {
        // Gravatar supports SHA256 hashes
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexStringLower(hashBytes);
    }
}
