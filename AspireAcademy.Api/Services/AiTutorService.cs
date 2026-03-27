using System.Runtime.CompilerServices;
using System.Text.Json;
using OpenAI;
using OpenAI.Chat;

namespace AspireAcademy.Api.Services;

/// <summary>
/// Wrapper service for Azure AI Foundry / OpenAI chat completions used by the AI tutor endpoints.
/// Uses the Aspire Azure.AI.OpenAI client integration which auto-detects Azure vs plain OpenAI.
/// </summary>
public sealed class AiTutorService
{
    private static readonly JsonSerializerOptions s_jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly OpenAIClient? _openAIClient;
    private readonly string _modelDeployment;
    private readonly string? _configError;
    private readonly ILogger<AiTutorService> _logger;

    public AiTutorService(IConfiguration configuration, ILogger<AiTutorService> logger, OpenAIClient? openAIClient = null)
    {
        _logger = logger;
        _openAIClient = openAIClient;
        _modelDeployment = configuration["AI:ModelDeployment"] ?? "gpt-4o";

        if (_openAIClient is null)
        {
            _configError = "OpenAI client not configured. Set ConnectionStrings:openai to \"Endpoint=https://your-resource.services.ai.azure.com/;Key=your-key\" or \"Key=sk-...\"";
            _logger.LogWarning("AI not configured: {Reason}", _configError);
        }
        else
        {
            _logger.LogInformation("AI tutor initialized with model deployment={Model}", _modelDeployment);
        }
    }

    private ChatClient GetClientOrThrow()
    {
        if (_openAIClient is null)
        {
            throw new InvalidOperationException(_configError ?? "AI tutor is not configured.");
        }

        return _openAIClient.GetChatClient(_modelDeployment);
    }

    /// <summary>
    /// Streams a chat response given a user message, conversation history, and lesson context.
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

        _logger.LogInformation("AI chat request, model={Model}, messageCount={MessageCount}", _modelDeployment, messages.Count);

        var chatClient = GetClientOrThrow();
        var updates = chatClient.CompleteChatStreamingAsync(messages, cancellationToken: cancellationToken);

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
    /// Returns a hint for the given challenge. Uses stored hints when available, otherwise generates via AI.
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

        var chatClient = GetClientOrThrow();
        var result = await chatClient.CompleteChatAsync(messages);

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

        var chatClient = GetClientOrThrow();
        var result = await chatClient.CompleteChatAsync(messages);
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
}

public record ConversationMessage(string Role, string Content);

public record CodeChallengeInfo(string Instructions, List<string>? Hints);

public record CodeReview(string OverallFeedback, List<CodeSuggestion> Suggestions, string Rating);

public record CodeSuggestion(int Line, string Type, string Message);
