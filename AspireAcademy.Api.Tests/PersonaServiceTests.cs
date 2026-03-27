using AspireAcademy.Api.Models;
using AspireAcademy.Api.Services;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

/// <summary>
/// Unit tests for PersonaService logic — relevance resolution,
/// fallback behavior, and data integrity after loading.
/// </summary>
public class PersonaServiceTests : TestFixture
{
    private PersonaService GetService()
    {
        return Factory.Services.GetRequiredService<PersonaService>();
    }

    // ════════════════════════════════════════════════
    // Loading
    // ════════════════════════════════════════════════

    [Fact]
    public void GetAll_ReturnsFourPersonas()
    {
        var service = GetService();
        var personas = service.GetAll();

        personas.Should().HaveCount(4);
        personas.Select(p => p.Id).Should().BeEquivalentTo(
            [PersonaTypes.DevOps, PersonaTypes.CSharp, PersonaTypes.JavaScript, PersonaTypes.Polyglot]);
    }

    [Fact]
    public void GetAll_PersonasHaveNonEmptyData()
    {
        var service = GetService();
        var personas = service.GetAll();

        personas.Should().AllSatisfy(p =>
        {
            p.Name.Should().NotBeNullOrEmpty();
            p.Icon.Should().NotBeNullOrEmpty();
            p.Color.Should().NotBeNullOrEmpty();
            p.Description.Should().NotBeNullOrEmpty();
            p.FocusAreas.Should().NotBeEmpty();
            p.ModuleDefaults.Should().NotBeEmpty();
        });
    }

    [Fact]
    public void GetAll_PersonasHaveGuideContent()
    {
        var service = GetService();
        var personas = service.GetAll();

        personas.Should().AllSatisfy(p =>
        {
            p.GuideContent.Should().NotBeNullOrEmpty(
                $"persona '{p.Id}' should have a guide markdown file");
        });
    }

    // ════════════════════════════════════════════════
    // GetById
    // ════════════════════════════════════════════════

    [Theory]
    [InlineData("devops")]
    [InlineData("csharp")]
    [InlineData("javascript")]
    [InlineData("polyglot")]
    public void GetById_WithValidId_ReturnsPersona(string personaId)
    {
        var service = GetService();
        var persona = service.GetById(personaId);

        persona.Should().NotBeNull();
        persona!.Id.Should().Be(personaId);
    }

    [Fact]
    public void GetById_WithInvalidId_ReturnsNull()
    {
        var service = GetService();
        var result = service.GetById("nonexistent");

        result.Should().BeNull();
    }

    [Fact]
    public void GetById_IsCaseInsensitive()
    {
        var service = GetService();

        var lower = service.GetById("devops");
        var upper = service.GetById("DEVOPS");
        var mixed = service.GetById("DevOps");

        lower.Should().NotBeNull();
        upper.Should().NotBeNull();
        mixed.Should().NotBeNull();
        lower!.Id.Should().Be(upper!.Id).And.Be(mixed!.Id);
    }

    // ════════════════════════════════════════════════
    // GetRelevance — module defaults
    // ════════════════════════════════════════════════

    [Fact]
    public void GetRelevance_UsesModuleDefault()
    {
        var service = GetService();

        // Module "1.1" is "high" for devops in personas.yaml
        var relevance = service.GetRelevance("devops", "1.1.1", "1.1");

        relevance.Should().Be(PersonaRelevance.High);
    }

    [Fact]
    public void GetRelevance_DifferentPersonasReturnDifferentRelevance()
    {
        var service = GetService();

        // Module "9.1" (Polyglot Internals) is "low" for devops, "high" for javascript
        var devops = service.GetRelevance("devops", "9.1.1", "9.1");
        var js = service.GetRelevance("javascript", "9.1.1", "9.1");

        devops.Should().Be(PersonaRelevance.Low);
        js.Should().Be(PersonaRelevance.High);
    }

    // ════════════════════════════════════════════════
    // GetRelevance — lesson overrides
    // ════════════════════════════════════════════════

    [Fact]
    public void GetRelevance_LessonOverrideTakesPriority()
    {
        var service = GetService();

        // For C# persona: module "3.3" defaults to "medium",
        // but lesson "3.3.1" is overridden to "low" in personas.yaml
        var moduleDefault = service.GetRelevance("csharp", "some-other-lesson-in-3.3", "3.3"); // no override → module default
        var lessonOverride = service.GetRelevance("csharp", "3.3.1", "3.3"); // explicitly overridden

        moduleDefault.Should().Be(PersonaRelevance.Medium, "lessons without overrides should use module default");
        lessonOverride.Should().Be(PersonaRelevance.Low, "lesson override should take priority over module default");
    }

    // ════════════════════════════════════════════════
    // GetRelevance — fallback to medium
    // ════════════════════════════════════════════════

    [Fact]
    public void GetRelevance_FallsBackToMediumForUndefinedModule()
    {
        var service = GetService();

        // "unknown-module" doesn't exist in any persona's moduleDefaults
        var relevance = service.GetRelevance("devops", "unknown-lesson", "unknown-module");

        relevance.Should().Be(PersonaRelevance.Medium);
    }

    [Fact]
    public void GetRelevance_ReturnsNullForInvalidPersona()
    {
        var service = GetService();

        var relevance = service.GetRelevance("nonexistent", "1.1.1", "1.1");

        relevance.Should().BeNull();
    }

    // ════════════════════════════════════════════════
    // GetAllRelevance
    // ════════════════════════════════════════════════

    [Fact]
    public void GetAllRelevance_ReturnsAllFourPersonas()
    {
        var service = GetService();

        var relevance = service.GetAllRelevance("1.1.1", "1.1");

        relevance.Should().HaveCount(4);
        relevance.Keys.Should().BeEquivalentTo(["devops", "csharp", "javascript", "polyglot"]);
    }

    [Fact]
    public void GetAllRelevance_ValuesAreValidRelevanceLevels()
    {
        var service = GetService();
        var validLevels = new[] { PersonaRelevance.High, PersonaRelevance.Medium, PersonaRelevance.Low, PersonaRelevance.Skip };

        var relevance = service.GetAllRelevance("1.1.1", "1.1");

        relevance.Values.Should().AllSatisfy(v =>
        {
            validLevels.Should().Contain(v);
        });
    }

    [Fact]
    public void GetAllRelevance_ForWorld1_AllPersonasAreHigh()
    {
        var service = GetService();

        // World 1 foundations — all personas should be "high" for module 1.1
        var relevance = service.GetAllRelevance("1.1.1", "1.1");

        relevance.Values.Should().AllBe(PersonaRelevance.High,
            "World 1 (foundations) should be high relevance for all personas");
    }

    // ════════════════════════════════════════════════
    // PersonaTypes constants
    // ════════════════════════════════════════════════

    [Fact]
    public void PersonaTypes_All_ContainsExactlyFourValues()
    {
        PersonaTypes.All.Should().HaveCount(4);
        PersonaTypes.All.Should().BeEquivalentTo(["devops", "csharp", "javascript", "polyglot"]);
    }

    [Fact]
    public void PersonaRelevance_Constants_AreCorrect()
    {
        PersonaRelevance.High.Should().Be("high");
        PersonaRelevance.Medium.Should().Be("medium");
        PersonaRelevance.Low.Should().Be("low");
        PersonaRelevance.Skip.Should().Be("skip");
    }
}
