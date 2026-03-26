using System.Collections.Concurrent;
using System.Reflection;
using StackExchange.Redis;

namespace AspireAcademy.Api.Tests;

/// <summary>
/// In-memory substitute for Redis using DispatchProxy.
/// Supports StringIncrement (for rate limiting) and sorted set operations (for leaderboards).
/// </summary>
public sealed class FakeRedis
{
    public ConcurrentDictionary<string, long> Counters { get; } = new();
    public IConnectionMultiplexer Multiplexer { get; }
    public IDatabase Database { get; }

    public FakeRedis()
    {
        Database = FakeRedisDatabaseProxy.Create(Counters);
        Multiplexer = FakeRedisMultiplexerProxy.Create(Database);
    }

    public void Reset() => Counters.Clear();
}

public class FakeRedisDatabaseProxy : DispatchProxy
{
    private ConcurrentDictionary<string, long> _counters = new();

    public static IDatabase Create(ConcurrentDictionary<string, long> counters)
    {
        var proxy = Create<IDatabase, FakeRedisDatabaseProxy>();
        ((FakeRedisDatabaseProxy)(object)proxy)._counters = counters;
        return proxy;
    }

    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
    {
        if (targetMethod is null) return null;

        return targetMethod.Name switch
        {
            "StringIncrementAsync" when targetMethod.ReturnType == typeof(Task<long>)
                => HandleStringIncrementLong(args!),
            "StringIncrementAsync"
                => Task.FromResult(0.0),
            "KeyExpireAsync"
                => Task.FromResult(true),
            "SortedSetIncrementAsync"
                => Task.FromResult(0.0),
            "SortedSetAddAsync"
                => Task.FromResult(true),
            "SortedSetRangeByRankWithScoresAsync"
                => Task.FromResult(Array.Empty<SortedSetEntry>()),
            "SortedSetRankAsync"
                => Task.FromResult((long?)null),
            "SortedSetScoreAsync"
                => Task.FromResult((double?)null),
            "SortedSetLengthAsync"
                => Task.FromResult(0L),
            _ => DefaultReturn(targetMethod.ReturnType)
        };
    }

    private Task<long> HandleStringIncrementLong(object?[] args)
    {
        var key = args[0]?.ToString() ?? "";
        var increment = args.Length > 1 && args[1] is long inc ? inc : 1L;
        var result = _counters.AddOrUpdate(key, increment, (_, v) => v + increment);
        return Task.FromResult(result);
    }

    internal static object? DefaultReturn(Type returnType)
    {
        if (returnType == typeof(void)) return null;
        if (returnType == typeof(Task)) return Task.CompletedTask;
        if (returnType == typeof(ValueTask)) return default(ValueTask);
        if (returnType == typeof(string)) return string.Empty;

        if (returnType.IsGenericType)
        {
            var def = returnType.GetGenericTypeDefinition();
            if (def == typeof(Task<>))
            {
                var inner = returnType.GetGenericArguments()[0];
                var val = inner.IsValueType ? Activator.CreateInstance(inner) : null;
                return typeof(Task)
                    .GetMethod(nameof(Task.FromResult))!
                    .MakeGenericMethod(inner)
                    .Invoke(null, [val]);
            }

            if (def == typeof(ValueTask<>))
            {
                var inner = returnType.GetGenericArguments()[0];
                var val = inner.IsValueType ? Activator.CreateInstance(inner) : null;
                return Activator.CreateInstance(returnType, val);
            }
        }

        if (returnType.IsValueType) return Activator.CreateInstance(returnType);
        return null;
    }
}

public class FakeRedisMultiplexerProxy : DispatchProxy
{
    private IDatabase _database = null!;

    public static IConnectionMultiplexer Create(IDatabase database)
    {
        var proxy = Create<IConnectionMultiplexer, FakeRedisMultiplexerProxy>();
        ((FakeRedisMultiplexerProxy)(object)proxy)._database = database;
        return proxy;
    }

    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
    {
        if (targetMethod is null) return null;

        return targetMethod.Name switch
        {
            "GetDatabase" => _database,
            "GetServers" => Array.Empty<IServer>(),
            "get_IsConnected" => true,
            "get_IsConnecting" => false,
            "get_Configuration" => "fake:6379",
            "get_ClientName" => "FakeRedis",
            "get_TimeoutMilliseconds" => 5000,
            "get_OperationCount" => 0L,
            "ToString" => "FakeRedisMultiplexer",
            _ => FakeRedisDatabaseProxy.DefaultReturn(targetMethod.ReturnType)
        };
    }
}
