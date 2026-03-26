using System.ClientModel;
using System.Runtime.CompilerServices;
using System.Text.Json;
using OpenAI;
using OpenAI.Chat;

namespace AspireAcademy.Api.Services;

/// <summary>
/// Wrapper service for OpenAI chat completions used by the AI tutor endpoints.
/// </summary>
public sealed class AiTutorService
{
    private static readonly JsonSerializerOptions s_jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly ChatClient? _chatClient;
    private readonly string? _configError;
    private readonly ILogger<AiTutorService> _logger;

    public AiTutorService(IConfiguration configuration, ILogger<AiTutorService> logger)
    {
        _logger = logger;
        var connectionString = configuration.GetConnectionString("openai");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            _configError = "OpenAI connection string 'openai' is not configured. Set it via: aspire secret set ConnectionStrings:openai \"Key=sk-...\"";
            _logger.LogWarning("OpenAI not configured: {Reason}", _configError);
            return;
        }

        try
        {
            var (endpoint, apiKey) = ParseConnectionString(connectionString);
            _logger.LogInformation("OpenAI client initialized with endpoint={Endpoint}", endpoint ?? "(default)");
            var client = endpoint is not null
                ? new OpenAIClient(new ApiKeyCredential(apiKey), new OpenAIClientOptions { Endpoint = new Uri(endpoint) })
                : new OpenAIClient(apiKey);
            _chatClient = client.GetChatClient("gpt-4o");
        }
        catch (Exception ex)
        {
            _configError = $"Failed to initialize OpenAI client: {ex.Message}";
            _logger.LogError(ex, "OpenAI client initialization failed: {Message}", ex.Message);
        }
    }

    private ChatClient GetClientOrThrow() =>
        _chatClient ?? throw new InvalidOperationException(_configError ?? "AI tutor is not configured.");

    /// <summary>
    /// Streams a chat response from OpenAI given a user message, conversation history, and lesson context.
    /// </summary>
    public async IAsyncEnumerable<string> ChatAsync(
        string message,
        List<ConversationMessage>? history,
        string? lessonContext,
        int userLevel,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var systemPrompt = $"You are an Aspire Academy tutor helping a Level {userLevel} student learn .NET Aspire.";
        if (lessonContext is not null)
        {
            systemPrompt += $" Current lesson: {lessonContext}.";
        }
        systemPrompt += " Be encouraging and use examples.";

        var messages = new List<ChatMessage> { ChatMessage.CreateSystemMessage(systemPrompt) };

        if (history is not null)
        {
            foreach (var msg in history)
            {
                messages.Add(msg.Role switch
                {
                    "assistant" => ChatMessage.CreateAssistantMessage(msg.Content),
                    _ => ChatMessage.CreateUserMessage(msg.Content)
                });
            }
        }

        messages.Add(ChatMessage.CreateUserMessage(message));

        _logger.LogInformation("AI chat request, model=gpt-4o, messageCount={MessageCount}", messages.Count);

        var updates = GetClientOrThrow().CompleteChatStreamingAsync(messages, cancellationToken: cancellationToken);

        await foreach (var update in updates)
        {
            foreach (var part in update.ContentUpdate)
            {
                if (!string.IsNullOrEmpty(part.Text))
                {
                    yield return part.Text;
                }
            }
        }
    }

    /// <summary>
    /// Returns a hint for the given challenge. Uses stored hints when available, otherwise generates via OpenAI.
    /// </summary>
    public async Task<string> GetHintAsync(CodeChallengeInfo challenge, string currentCode, int hintLevel)
    {
        if (challenge.Hints is { Count: > 0 } hints && hintLevel <= hints.Count)
        {
            return hints[hintLevel - 1];
        }

        var levelDescription = hintLevel switch
        {
            1 => "Give a gentle nudge without revealing the answer. Be brief.",
            2 => "Give specific direction about what approach or method to use next.",
            _ => "Give a near-solution hint that almost reveals the answer with a code snippet."
        };

        var messages = new List<ChatMessage>
        {
            ChatMessage.CreateSystemMessage(
                $"You are a .NET Aspire coding tutor providing a hint. {levelDescription}"),
            ChatMessage.CreateUserMessage(
                $"Challenge instructions:\n{challenge.Instructions}\n\nStudent's current code:\n```csharp\n{currentCode}\n```\n\nProvide a helpful hint.")
        };

        var result = await GetClientOrThrow().CompleteChatAsync(messages);

        return result.Value.Content[0].Text;
    }

    /// <summary>
    /// Reviews student code against challenge requirements and returns structured feedback.
    /// </summary>
    public async Task<CodeReview> ReviewCodeAsync(string challengeInstructions, string code)
    {
        var messages = new List<ChatMessage>
        {
            ChatMessage.CreateSystemMessage("""
                You are a .NET Aspire code reviewer. Review the student's code against the challenge requirements.
                Return your review as JSON with this exact format (no markdown fences):
                {
                    "overallFeedback": "string",
                    "suggestions": [
                        { "line": 1, "type": "improvement", "message": "string" }
                    ],
                    "rating": "needs-work|good|excellent"
                }
                type must be one of: "improvement", "issue".
                rating must be one of: "needs-work", "good", "excellent".
                Only return valid JSON.
                """),
            ChatMessage.CreateUserMessage(
                $"Challenge:\n{challengeInstructions}\n\nStudent's code:\n```csharp\n{code}\n```")
        };

        var result = await GetClientOrThrow().CompleteChatAsync(messages);
        var responseText = result.Value.Content[0].Text;

        try
        {
            return JsonSerializer.Deserialize<CodeReview>(responseText, s_jsonOptions)
                ?? new CodeReview("Unable to generate review.", [], "good");
        }
        catch (JsonException)
        {
            return new CodeReview(responseText, [], "good");
        }
    }

    private static (string? Endpoint, string ApiKey) ParseConnectionString(string connectionString)
    {
        if (!connectionString.Contains('='))
        {
            return (null, connectionString);
        }

        string? endpoint = null;
        var apiKey = string.Empty;

        foreach (var part in connectionString.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            var kvp = part.Split('=', 2);
            if (kvp.Length is not 2)
            {
                continue;
            }

            if (kvp[0].Equals("Endpoint", StringComparison.OrdinalIgnoreCase))
            {
                endpoint = kvp[1];
            }
            else if (kvp[0].Equals("Key", StringComparison.OrdinalIgnoreCase))
            {
                apiKey = kvp[1];
            }
        }

        return (endpoint, apiKey);
    }
}

public record ConversationMessage(string Role, string Content);

public record CodeChallengeInfo(string Instructions, List<string>? Hints);

public record CodeReview(string OverallFeedback, List<CodeSuggestion> Suggestions, string Rating);

public record CodeSuggestion(int Line, string Type, string Message);
