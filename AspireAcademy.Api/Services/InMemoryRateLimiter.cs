using System.Collections.Concurrent;

namespace AspireAcademy.Api.Services;

/// <summary>
/// Simple in-memory sliding window rate limiter for code run/submit endpoints.
/// Replaces Redis-based rate limiting for single-instance deployments.
/// </summary>
public sealed class InMemoryRateLimiter
{
    private readonly ConcurrentDictionary<string, List<DateTime>> _windows = new();

    /// <summary>
    /// Returns true if the request is allowed, false if rate-limited.
    /// </summary>
    public bool IsAllowed(string key, int maxRequests, TimeSpan window)
    {
        var now = DateTime.UtcNow;
        var cutoff = now - window;

        var timestamps = _windows.GetOrAdd(key, _ => new List<DateTime>());

        lock (timestamps)
        {
            timestamps.RemoveAll(t => t < cutoff);

            if (timestamps.Count >= maxRequests)
            {
                return false;
            }

            timestamps.Add(now);
            return true;
        }
    }
}
