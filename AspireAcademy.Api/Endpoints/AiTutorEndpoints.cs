using System.Security.Claims;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

public static class AiTutorEndpoints
{
    private static ILogger s_logger = null!;

    private static readonly JsonSerializerOptions s_jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static WebApplication MapAiTutorEndpoints(this WebApplication app)
    {
        s_logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("AiTutorEndpoints");

        var group = app.MapGroup("/api/ai").RequireAuthorization();

        group.MapPost("/chat", async (AiChatRequest request, AcademyDbContext db, AiTutorService aiService, ClaimsPrincipal user, HttpContext httpContext) =>
        {
            var userId = EndpointHelpers.GetUserId(user);
            s_logger.LogInformation("AI chat for UserId={UserId}, lessonId={LessonId}",
                userId, request.Context?.CurrentLessonId);
            var currentUser = await db.Users.FindAsync(userId);

            if (currentUser is null)
            {
                httpContext.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await httpContext.Response.WriteAsJsonAsync(new ErrorResponse("User not found."), s_jsonOptions);
                return;
            }

            var userXp = await db.UserXp.FirstOrDefaultAsync(x => x.UserId == userId);

            string? lessonContext = null;
            if (request.Context?.CurrentLessonId is not null)
            {
                var lesson = await db.Lessons.FindAsync(request.Context.CurrentLessonId);
                lessonContext = lesson?.Title;
            }

            httpContext.Response.ContentType = "text/event-stream";
            httpContext.Response.Headers.CacheControl = "no-cache";
            httpContext.Response.Headers.Connection = "keep-alive";

            await foreach (var chunk in aiService.ChatAsync(
                request.Message,
                request.Context?.ConversationHistory,
                lessonContext,
                userXp?.CurrentLevel ?? 1,
                httpContext.RequestAborted))
            {
                var json = JsonSerializer.Serialize(new { content = chunk }, s_jsonOptions);
                await httpContext.Response.WriteAsync($"data: {json}\n\n", httpContext.RequestAborted);
                await httpContext.Response.Body.FlushAsync(httpContext.RequestAborted);
            }

            await httpContext.Response.WriteAsync("data: [DONE]\n\n", httpContext.RequestAborted);
            await httpContext.Response.Body.FlushAsync(httpContext.RequestAborted);
        });

        group.MapPost("/hint", async (AiHintRequest request, AcademyDbContext db, AiTutorService aiService, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.GetUserId(user);
            s_logger.LogInformation("AI hint level={HintLevel} for ChallengeId={ChallengeId}", request.HintLevel, request.ChallengeId);

            if (request.HintLevel is < 1 or > 3)
            {
                return Results.BadRequest(new ErrorResponse("Hint level must be between 1 and 3."));
            }

            var challenge = await db.CodeChallenges.FindAsync(request.ChallengeId);
            if (challenge is null)
            {
                return Results.NotFound(new ErrorResponse("Challenge not found."));
            }

            var hints = challenge.Hints.Deserialize<List<string>>(s_jsonOptions);
            var challengeInfo = new CodeChallengeInfo(challenge.InstructionsMarkdown, hints);
            var hint = await aiService.GetHintAsync(challengeInfo, request.CurrentCode, request.HintLevel);

            return Results.Ok(new AiHintResponse(hint));
        });

        group.MapPost("/review", async (AiReviewRequest request, AcademyDbContext db, AiTutorService aiService, ClaimsPrincipal user) =>
        {
            _ = EndpointHelpers.GetUserId(user);

            var challenge = await db.CodeChallenges.FindAsync(request.ChallengeId);
            if (challenge is null)
            {
                return Results.NotFound(new ErrorResponse("Challenge not found."));
            }

            var review = await aiService.ReviewCodeAsync(challenge.InstructionsMarkdown, request.Code);

            return Results.Ok(review);
        });

        return app;
    }

}

// Request / response DTOs

file record AiChatRequest(string Message, AiChatContext? Context);

file record AiChatContext(string? CurrentLessonId, List<ConversationMessage>? ConversationHistory);

file record AiHintRequest(Guid ChallengeId, string CurrentCode, int HintLevel);

file record AiHintResponse(string Hint);

file record AiReviewRequest(Guid ChallengeId, string Code);
