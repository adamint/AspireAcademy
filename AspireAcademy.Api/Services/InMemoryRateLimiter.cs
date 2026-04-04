using System.Collections.Concurrent;

namespace AspireAcademy.Api.Services;

/// <summary>
/// Simple in-memory sliding window rate limiter for code run/submit endpoints.
/// Replaces Redis-based rate limiting for single-instance deployments.
/// </summary>
public sealed class InMemoryRateLimiter
{
    private readonly ConcurrentDictionary<string, List<DateTime>> _windows = new();
    private int _callCount;

    // Purge stale keys every N calls to prevent unbounded memory growth
    private const int CleanupInterval = 100;

    /// <summary>
    /// Returns true if the request is allowed, false if rate-limited.
    /// </summary>
    public bool IsAllowed(string key, int maxRequests, TimeSpan window)
    {
        var now = DateTime.UtcNow;
        var cutoff = now - window;

        // Periodic cleanup: remove dictionary entries whose timestamps are all expired
        if (Interlocked.Increment(ref _callCount) % CleanupInterval == 0)
        {
            foreach (var kvp in _windows)
            {
                lock (kvp.Value)
                {
                    kvp.Value.RemoveAll(t => t < cutoff);
                    if (kvp.Value.Count == 0)
                    {
                        _windows.TryRemove(kvp.Key, out _);
                    }
                }
            }
        }

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
