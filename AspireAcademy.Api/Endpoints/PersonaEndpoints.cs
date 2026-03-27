using System.Security.Claims;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace AspireAcademy.Api.Endpoints;

public static class PersonaEndpoints
{
    private static ILogger s_logger = null!;

    public static WebApplication MapPersonaEndpoints(this WebApplication app)
    {
        s_logger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("PersonaEndpoints");

        var group = app.MapGroup("/api/personas").WithTags("Personas");

        group.MapGet("/", GetPersonas).AllowAnonymous();
        group.MapGet("/{personaId}", GetPersonaDetail).AllowAnonymous();
        group.MapPut("/select", SelectPersona).RequireAuthorization();

        return app;
    }

    /// <summary>Returns the list of available personas (without guide content).</summary>
    private static IResult GetPersonas(PersonaService personaService)
    {
        var personas = personaService.GetAll();

        var result = personas.Select(p => new PersonaSummaryDto(
            p.Id, p.Name, p.Icon, p.Color, p.Description, p.FocusAreas)).ToList();

        return Results.Ok(result);
    }

    /// <summary>Returns a single persona with its full guide content (markdown).</summary>
    private static IResult GetPersonaDetail(string personaId, PersonaService personaService)
    {
        var persona = personaService.GetById(personaId);
        if (persona is null)
        {
            return Results.NotFound(new ErrorResponse("Persona not found."));
        }

        return Results.Ok(new PersonaDetailDto(
            persona.Id,
            persona.Name,
            persona.Icon,
            persona.Color,
            persona.Description,
            persona.FocusAreas,
            persona.GuideContent));
    }

    /// <summary>Sets the current user's persona. Pass null to clear.</summary>
    private static async Task<IResult> SelectPersona(
        SelectPersonaRequest request,
        ClaimsPrincipal principal,
        AcademyDbContext db,
        PersonaService personaService)
    {
        var userId = EndpointHelpers.GetUserId(principal);

        // Validate persona ID if provided
        if (request.PersonaId is not null)
        {
            var persona = personaService.GetById(request.PersonaId);
            if (persona is null)
            {
                return Results.BadRequest(new ErrorResponse($"Unknown persona: {request.PersonaId}"));
            }
        }

        var user = await db.Users.FindAsync(userId);
        if (user is null)
        {
            return Results.NotFound(new ErrorResponse("User not found."));
        }

        user.Persona = request.PersonaId;
        await db.SaveChangesAsync();

        s_logger.LogInformation("User {UserId} selected persona {Persona}", userId, request.PersonaId ?? "(none)");
        return Results.Ok(new { persona = user.Persona });
    }
}

// --- DTOs ---

public record PersonaSummaryDto(
    string Id,
    string Name,
    string Icon,
    string Color,
    string Description,
    List<string> FocusAreas);

public record PersonaDetailDto(
    string Id,
    string Name,
    string Icon,
    string Color,
    string Description,
    List<string> FocusAreas,
    string? GuideContent);

public record SelectPersonaRequest(string? PersonaId);
