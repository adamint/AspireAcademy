using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace AspireAcademy.Api.Services;

/// <summary>
/// Loads persona definitions from personas.yaml and provides relevance lookups.
/// Personas are advisory-only — they never gate content.
/// </summary>
public class PersonaService
{
    private readonly ILogger<PersonaService> _logger;
    private readonly string _curriculumPath;
    private readonly IDeserializer _yaml;

    private List<PersonaInfo> _personas = [];
    private Dictionary<string, PersonaInfo> _personaById = new(StringComparer.OrdinalIgnoreCase);
    private bool _loaded;

    public PersonaService(ILogger<PersonaService> logger, IWebHostEnvironment env)
    {
        _logger = logger;
        _curriculumPath = Path.Combine(env.ContentRootPath, "Curriculum");
        _yaml = new DeserializerBuilder()
            .WithNamingConvention(CamelCaseNamingConvention.Instance)
            .IgnoreUnmatchedProperties()
            .Build();
    }

    public async Task LoadAsync(CancellationToken ct = default)
    {
        var personasFile = Path.Combine(_curriculumPath, "personas.yaml");
        if (!File.Exists(personasFile))
        {
            _logger.LogWarning("No personas.yaml found at {Path}", personasFile);
            return;
        }

        var yamlContent = await File.ReadAllTextAsync(personasFile, ct);
        var def = _yaml.Deserialize<PersonasDefinition>(yamlContent);

        if (def?.Personas is null || def.Personas.Count == 0)
        {
            _logger.LogWarning("personas.yaml contains no persona definitions");
            return;
        }

        var personas = new List<PersonaInfo>();
        foreach (var p in def.Personas)
        {
            // Load the guide markdown content if specified
            string? guideContent = null;
            if (!string.IsNullOrEmpty(p.ContentFile))
            {
                var contentPath = Path.Combine(_curriculumPath, "content", p.ContentFile);
                if (File.Exists(contentPath))
                {
                    guideContent = await File.ReadAllTextAsync(contentPath, ct);
                }
            }

            personas.Add(new PersonaInfo(
                p.Id,
                p.Name,
                p.Icon,
                p.Color,
                p.Description,
                p.FocusAreas,
                guideContent,
                p.ModuleDefaults,
                p.LessonOverrides));
        }

        _personas = personas;
        _personaById = personas.ToDictionary(p => p.Id, StringComparer.OrdinalIgnoreCase);
        _loaded = true;

        _logger.LogInformation("Loaded {Count} personas from personas.yaml", _personas.Count);
    }

    public IReadOnlyList<PersonaInfo> GetAll() => _personas;

    public PersonaInfo? GetById(string personaId)
    {
        EnsureLoaded();
        return _personaById.GetValueOrDefault(personaId);
    }

    /// <summary>
    /// Gets the relevance level for a specific lesson and persona.
    /// Returns null if the persona doesn't exist or no relevance is defined.
    /// </summary>
    public string? GetRelevance(string personaId, string lessonId, string moduleId)
    {
        EnsureLoaded();
        if (!_personaById.TryGetValue(personaId, out var persona))
            return null;

        // Lesson-level override takes priority
        if (persona.LessonOverrides.TryGetValue(lessonId, out var lessonRelevance))
            return lessonRelevance;

        // Fall back to module default
        if (persona.ModuleDefaults.TryGetValue(moduleId, out var moduleRelevance))
            return moduleRelevance;

        // Default to medium if no mapping exists
        return Models.PersonaRelevance.Medium;
    }

    /// <summary>
    /// Gets relevance for all personas for a given lesson.
    /// Returns a dictionary of personaId → relevance level.
    /// </summary>
    public Dictionary<string, string> GetAllRelevance(string lessonId, string moduleId)
    {
        EnsureLoaded();
        var result = new Dictionary<string, string>();
        foreach (var persona in _personas)
        {
            var relevance = GetRelevance(persona.Id, lessonId, moduleId);
            if (relevance is not null)
                result[persona.Id] = relevance;
        }
        return result;
    }

    private void EnsureLoaded()
    {
        if (!_loaded)
            _logger.LogWarning("PersonaService queried before Load() was called");
    }
}

// --- Models ---

public record PersonaInfo(
    string Id,
    string Name,
    string Icon,
    string Color,
    string Description,
    List<string> FocusAreas,
    string? GuideContent,
    Dictionary<string, string> ModuleDefaults,
    Dictionary<string, string> LessonOverrides);

// --- YAML deserialization models ---

internal class PersonasDefinition
{
    public List<PersonaDefinition> Personas { get; set; } = [];
}

internal class PersonaDefinition
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Icon { get; set; } = "";
    public string Color { get; set; } = "";
    public string Description { get; set; } = "";
    public List<string> FocusAreas { get; set; } = [];
    public string? ContentFile { get; set; }
    public Dictionary<string, string> ModuleDefaults { get; set; } = new();
    public Dictionary<string, string> LessonOverrides { get; set; } = new();
}
