using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using AspireAcademy.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

public class PersonaEndpointsTests : TestFixture
{
    // ════════════════════════════════════════════════
    // GET /api/personas
    // ════════════════════════════════════════════════

    [Fact]
    public async Task GetPersonas_ReturnsAllFourPersonas()
    {
        var response = await Client.GetAsync("/api/personas");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var personas = await response.Content.ReadFromJsonAsync<List<PersonaSummaryDto>>();
        personas.Should().NotBeNull();
        personas.Should().HaveCount(4);
        personas!.Select(p => p.Id).Should().BeEquivalentTo(["devops", "csharp", "javascript", "polyglot"]);
    }

    [Fact]
    public async Task GetPersonas_EachPersonaHasRequiredFields()
    {
        var response = await Client.GetAsync("/api/personas");

        var personas = await response.Content.ReadFromJsonAsync<List<PersonaSummaryDto>>();
        personas.Should().AllSatisfy(p =>
        {
            p.Id.Should().NotBeNullOrEmpty();
            p.Name.Should().NotBeNullOrEmpty();
            p.Icon.Should().NotBeNullOrEmpty();
            p.Color.Should().StartWith("#");
            p.Description.Should().NotBeNullOrEmpty();
            p.FocusAreas.Should().NotBeEmpty();
        });
    }

    [Fact]
    public async Task GetPersonas_DoesNotIncludeGuideContent()
    {
        var response = await Client.GetAsync("/api/personas");

        var raw = await response.Content.ReadAsStringAsync();
        // PersonaSummaryDto should NOT contain guideContent field
        raw.Should().NotContain("guideContent");
    }

    [Fact]
    public async Task GetPersonas_IsAccessibleAnonymously()
    {
        // Client has no auth token
        var response = await Client.GetAsync("/api/personas");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ════════════════════════════════════════════════
    // GET /api/personas/{id}
    // ════════════════════════════════════════════════

    [Theory]
    [InlineData("devops", "DevOps")]
    [InlineData("csharp", "C#")]
    [InlineData("javascript", "JS")]
    [InlineData("polyglot", "Polyglot")]
    public async Task GetPersonaDetail_AllPersonasReturnDetail(string personaId, string expectedNameSubstring)
    {
        var response = await Client.GetAsync($"/api/personas/{personaId}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var detail = await response.Content.ReadFromJsonAsync<PersonaDetailDto>();
        detail.Should().NotBeNull();
        detail!.Id.Should().Be(personaId);
        detail.Name.Should().Contain(expectedNameSubstring);
        detail.GuideContent.Should().NotBeNullOrEmpty("every persona should have a guide markdown file");
    }

    [Fact]
    public async Task GetPersonaDetail_WithInvalidId_Returns404()
    {
        var response = await Client.GetAsync("/api/personas/nonexistent");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetPersonaDetail_GuideContentContainsMarkdown()
    {
        var response = await Client.GetAsync("/api/personas/devops");

        var detail = await response.Content.ReadFromJsonAsync<PersonaDetailDto>();
        detail!.GuideContent.Should().Contain("#", "guide content should be markdown with headings");
        detail.GuideContent.Should().Contain("Aspire", "guide content should reference Aspire");
    }

    [Fact]
    public async Task GetPersonaDetail_IsAccessibleAnonymously()
    {
        var response = await Client.GetAsync("/api/personas/csharp");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    // ════════════════════════════════════════════════
    // PUT /api/personas/select
    // ════════════════════════════════════════════════

    [Fact]
    public async Task SelectPersona_WithValidPersona_SetsOnUser()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PutAsJsonAsync("/api/personas/select",
            new SelectPersonaRequest("devops"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("persona").GetString().Should().Be("devops");
    }

    [Fact]
    public async Task SelectPersona_PersistsToDatabase()
    {
        using var client = CreateAuthenticatedClient(TestUserId);
        await client.PutAsJsonAsync("/api/personas/select",
            new SelectPersonaRequest("javascript"));

        // Verify via DB
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();
        var user = await db.Users.FindAsync(TestUserId);
        user!.Persona.Should().Be("javascript");
    }

    [Fact]
    public async Task SelectPersona_WithNull_ClearsPersona()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        // First set a persona
        await client.PutAsJsonAsync("/api/personas/select",
            new SelectPersonaRequest("polyglot"));

        // Then clear it
        var response = await client.PutAsJsonAsync("/api/personas/select",
            new SelectPersonaRequest(null));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("persona").ValueKind.Should().Be(JsonValueKind.Null);

        // Verify DB
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();
        var user = await db.Users.FindAsync(TestUserId);
        user!.Persona.Should().BeNull();
    }

    [Fact]
    public async Task SelectPersona_WithInvalidPersona_Returns400()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.PutAsJsonAsync("/api/personas/select",
            new SelectPersonaRequest("nonexistent"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await ReadJsonAsync<ErrorResponse>(response);
        body!.Error.Should().Contain("nonexistent");
    }

    [Fact]
    public async Task SelectPersona_WithoutAuth_Returns401()
    {
        var response = await Client.PutAsJsonAsync("/api/personas/select",
            new SelectPersonaRequest("devops"));

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task SelectPersona_CanSwitchBetweenPersonas()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        // Select devops
        await client.PutAsJsonAsync("/api/personas/select",
            new SelectPersonaRequest("devops"));

        // Switch to csharp
        var response = await client.PutAsJsonAsync("/api/personas/select",
            new SelectPersonaRequest("csharp"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("persona").GetString().Should().Be("csharp");
    }

    [Fact]
    public async Task SelectPersona_SelectingSamePersonaTwiceIsIdempotent()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        await client.PutAsJsonAsync("/api/personas/select",
            new SelectPersonaRequest("devops"));
        var response = await client.PutAsJsonAsync("/api/personas/select",
            new SelectPersonaRequest("devops"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("persona").GetString().Should().Be("devops");
    }

    // ════════════════════════════════════════════════
    // Persona in Auth responses
    // ════════════════════════════════════════════════

    [Fact]
    public async Task GetMe_IncludesPersonaField()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/auth/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        // Persona should be present (null for users without one)
        body.TryGetProperty("persona", out _).Should().BeTrue();
    }

    [Fact]
    public async Task GetMe_ReflectsSelectedPersona()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        // Select persona
        await client.PutAsJsonAsync("/api/personas/select",
            new SelectPersonaRequest("polyglot"));

        // Verify GetMe returns it
        var response = await client.GetAsync("/api/auth/me");
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("persona").GetString().Should().Be("polyglot");
    }

    [Fact]
    public async Task Register_ReturnsNullPersona()
    {
        var request = new RegisterRequest("personauser", "persona@example.com", "Password1", "PersonaUser");
        var response = await Client.PostAsJsonAsync("/api/auth/register", request);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var userObj = body.GetProperty("user");
        userObj.TryGetProperty("persona", out var persona).Should().BeTrue();
        persona.ValueKind.Should().Be(JsonValueKind.Null);
    }

    // ════════════════════════════════════════════════
    // Persona relevance in curriculum DTOs
    // ════════════════════════════════════════════════

    [Fact]
    public async Task GetModuleLessons_IncludesPersonaRelevanceField()
    {
        var response = await Client.GetAsync("/api/modules/mod-1/lessons");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var lessons = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
        lessons.Should().NotBeNull();
        lessons!.Should().AllSatisfy(l =>
        {
            l.TryGetProperty("personaRelevance", out _).Should().BeTrue(
                "every lesson DTO should include personaRelevance");
        });
    }

    [Fact]
    public async Task GetLessonDetail_IncludesPersonaRelevanceField()
    {
        var response = await Client.GetAsync("/api/lessons/lesson-learn-1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var lesson = await response.Content.ReadFromJsonAsync<JsonElement>();
        lesson.TryGetProperty("personaRelevance", out var relevance).Should().BeTrue();
        // PersonaRelevance is a dictionary — should be an object (even if empty for test module IDs)
        relevance.ValueKind.Should().Be(JsonValueKind.Object);
    }

    [Fact]
    public async Task PersonaDoesNotAffectUnlockLogic()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        // Set persona
        await client.PutAsJsonAsync("/api/personas/select",
            new SelectPersonaRequest("csharp"));

        // Verify locked lessons are still locked regardless of persona
        var response = await client.GetAsync("/api/modules/mod-2/lessons");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var lessons = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
        var lockedLesson = lessons!.First(l => l.GetProperty("id").GetString() == "lesson-locked-1");
        lockedLesson.GetProperty("isUnlocked").GetBoolean().Should().BeFalse(
            "persona should never affect unlock logic");
    }
}
