using System.Text.Json;
using System.Text.RegularExpressions;

namespace AspireAcademy.Api.Services;

/// <summary>
/// Lightweight static code checker that validates student code without compilation.
/// Replaces the Docker-based CodeRunner for faster, more reliable feedback.
/// </summary>
public sealed class CodeCheckerService
{
    private static readonly HashSet<string> s_knownAspireMethods = new(StringComparer.Ordinal)
    {
        // Resource builders
        "AddPostgres", "AddRedis", "AddSqlServer", "AddMongoDB", "AddMySQL",
        "AddRabbitMQ", "AddKafka", "AddAzureCosmosDB", "AddAzureStorage",
        "AddAzureServiceBus", "AddAzureKeyVault", "AddAzureSignalR",
        "AddAzureOpenAI", "AddContainer", "AddDockerfile", "AddConnectionString",
        // Project / app builders
        "AddProject", "AddCSharpApp", "AddViteApp", "AddPythonApp", "AddNodeApp",
        "AddNpmApp", "AddExecutable",
        // Database helpers
        "AddDatabase",
        // Fluent configuration
        "WithReference", "WaitFor", "WithVolume", "WithEndpoint", "WithHttpEndpoint",
        "WithHttpsEndpoint", "WithExternalHttpEndpoints", "WithEnvironment",
        "WithArgs", "WithBindMount", "WithContainerRuntimeArgs",
        "WithDataVolume", "WithPgAdmin", "WithRedisCommander",
        "WithNpm", "WithPnpm", "WithYarn",
        // Application lifecycle
        "CreateBuilder", "Build", "Run",
    };

    /// <summary>
    /// Validates student code against the provided test cases without compilation.
    /// </summary>
    public CodeCheckResult Validate(string code, JsonDocument testCases, JsonDocument requiredPackages)
    {
        var structureValid = ValidateStructure(code);
        var testResults = new List<TestCaseCheckResult>();

        foreach (var tc in testCases.RootElement.EnumerateArray())
        {
            var testId = tc.GetProperty("id").GetString()!;
            var name = tc.GetProperty("name").GetString()!;
            var type = tc.GetProperty("type").GetString()!;
            var description = tc.GetProperty("description").GetString()!;

            var expected = tc.TryGetProperty("expected", out var exp) && exp.ValueKind != JsonValueKind.Null
                ? exp.GetString()
                : null;

            var (passed, detail) = EvaluateTestCase(type, code, expected, structureValid);
            testResults.Add(new TestCaseCheckResult(testId, name, passed, description, detail));
        }

        var apiWarnings = ValidateAspireApiCalls(code);
        var structureErrors = structureValid ? null : GetStructureErrors(code);

        return new CodeCheckResult(
            StructureValid: structureValid,
            StructureErrors: structureErrors,
            ApiWarnings: apiWarnings,
            TestResults: testResults);
    }

    /// <summary>
    /// Checks whether the code has a valid structure (balanced braces, reasonable syntax).
    /// This is NOT real compilation — just structural validation.
    /// </summary>
    public bool ValidateStructure(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return false;
        }

        // Check balanced braces
        if (!AreBracesBalanced(code))
        {
            return false;
        }

        // Check for unclosed string literals (simple heuristic)
        if (HasUnclosedStringLiterals(code))
        {
            return false;
        }

        // Must have some meaningful code (not just comments/whitespace)
        var meaningfulLines = code.Split('\n')
            .Select(l => l.Trim())
            .Where(l => l.Length > 0 && !l.StartsWith("//") && !l.StartsWith("/*"));

        if (!meaningfulLines.Any())
        {
            return false;
        }

        return true;
    }

    private static (bool Passed, string? Detail) EvaluateTestCase(
        string type, string code, string? expected, bool structureValid)
    {
        return type switch
        {
            "compiles" => (structureValid, structureValid ? null : "Code has structural issues"),
            "code-contains" => EvaluateCodeContains(code, expected),
            "code-pattern" => EvaluateCodePattern(code, expected),
            "output-equals" => (false, "Skipped — requires runtime execution"),
            "output-contains" => (false, "Skipped — requires runtime execution"),
            _ => (false, $"Unknown test type: {type}")
        };
    }

    private static (bool Passed, string? Detail) EvaluateCodeContains(string code, string? expected)
    {
        if (expected is null)
        {
            return (false, "No expected value specified");
        }

        var found = code.Contains(expected, StringComparison.Ordinal);
        return (found, found ? null : $"Code does not contain: {expected}");
    }

    private static (bool Passed, string? Detail) EvaluateCodePattern(string code, string? expected)
    {
        if (expected is null)
        {
            return (false, "No pattern specified");
        }

        try
        {
            var matches = Regex.IsMatch(code, expected, RegexOptions.None, TimeSpan.FromSeconds(1));
            return (matches, matches ? null : $"Code does not match pattern: {expected}");
        }
        catch (RegexMatchTimeoutException)
        {
            return (false, "Pattern match timed out");
        }
    }

    private static bool AreBracesBalanced(string code)
    {
        var depth = 0;
        var inString = false;
        var inVerbatim = false;
        var inChar = false;
        var inSingleLineComment = false;
        var inMultiLineComment = false;

        for (var i = 0; i < code.Length; i++)
        {
            var c = code[i];
            var next = i + 1 < code.Length ? code[i + 1] : '\0';

            if (inSingleLineComment)
            {
                if (c == '\n')
                {
                    inSingleLineComment = false;
                }

                continue;
            }

            if (inMultiLineComment)
            {
                if (c == '*' && next == '/')
                {
                    inMultiLineComment = false;
                    i++;
                }

                continue;
            }

            if (inChar)
            {
                if (c == '\\')
                {
                    i++; // skip escaped char
                }
                else if (c == '\'')
                {
                    inChar = false;
                }

                continue;
            }

            if (inVerbatim)
            {
                if (c == '"' && next == '"')
                {
                    i++; // escaped quote in verbatim string
                }
                else if (c == '"')
                {
                    inVerbatim = false;
                }

                continue;
            }

            if (inString)
            {
                if (c == '\\')
                {
                    i++; // skip escaped char
                }
                else if (c == '"')
                {
                    inString = false;
                }

                continue;
            }

            // Not inside any string/comment
            if (c == '/' && next == '/')
            {
                inSingleLineComment = true;
                i++;
                continue;
            }

            if (c == '/' && next == '*')
            {
                inMultiLineComment = true;
                i++;
                continue;
            }

            if (c == '@' && next == '"')
            {
                inVerbatim = true;
                i++;
                continue;
            }

            if (c == '"')
            {
                // Check for raw string literal (""")
                if (next == '"' && i + 2 < code.Length && code[i + 2] == '"')
                {
                    // Find closing """
                    var closeIdx = code.IndexOf("\"\"\"", i + 3, StringComparison.Ordinal);
                    if (closeIdx >= 0)
                    {
                        i = closeIdx + 2;
                    }

                    continue;
                }

                inString = true;
                continue;
            }

            if (c == '\'')
            {
                inChar = true;
                continue;
            }

            if (c == '{')
            {
                depth++;
            }
            else if (c == '}')
            {
                depth--;
                if (depth < 0)
                {
                    return false;
                }
            }
        }

        return depth == 0;
    }

    private static bool HasUnclosedStringLiterals(string code)
    {
        var inString = false;
        var inVerbatim = false;
        var inSingleLineComment = false;
        var inMultiLineComment = false;

        for (var i = 0; i < code.Length; i++)
        {
            var c = code[i];
            var next = i + 1 < code.Length ? code[i + 1] : '\0';

            if (inSingleLineComment)
            {
                if (c == '\n')
                {
                    inSingleLineComment = false;
                }

                continue;
            }

            if (inMultiLineComment)
            {
                if (c == '*' && next == '/')
                {
                    inMultiLineComment = false;
                    i++;
                }

                continue;
            }

            if (inVerbatim)
            {
                if (c == '"' && next == '"')
                {
                    i++;
                }
                else if (c == '"')
                {
                    inVerbatim = false;
                }

                continue;
            }

            if (inString)
            {
                if (c == '\\')
                {
                    i++;
                }
                else if (c == '"')
                {
                    inString = false;
                }
                else if (c == '\n')
                {
                    // Unclosed regular string (newline before closing quote)
                    return true;
                }

                continue;
            }

            if (c == '/' && next == '/')
            {
                inSingleLineComment = true;
                i++;
                continue;
            }

            if (c == '/' && next == '*')
            {
                inMultiLineComment = true;
                i++;
                continue;
            }

            if (c == '@' && next == '"')
            {
                inVerbatim = true;
                i++;
                continue;
            }

            if (c == '"')
            {
                if (next == '"' && i + 2 < code.Length && code[i + 2] == '"')
                {
                    var closeIdx = code.IndexOf("\"\"\"", i + 3, StringComparison.Ordinal);
                    if (closeIdx < 0)
                    {
                        return true; // unclosed raw string
                    }

                    i = closeIdx + 2;
                    continue;
                }

                inString = true;
            }
        }

        // If we end still inside a non-verbatim string, it's unclosed
        return inString;
    }

    private List<string> ValidateAspireApiCalls(string code)
    {
        var warnings = new List<string>();

        // Find method calls that look like Aspire builder patterns (e.g. builder.AddSomething or .WithSomething)
        var methodCallPattern = @"\.(Add\w+|With\w+|WaitFor|RunAsEmulator)\s*[<(]";
        var matches = Regex.Matches(code, methodCallPattern, RegexOptions.None, TimeSpan.FromSeconds(1));

        foreach (Match match in matches)
        {
            var methodName = match.Value.TrimStart('.');
            // Remove trailing <( characters
            methodName = methodName.TrimEnd('(', '<', ' ');

            if (methodName.StartsWith("Add", StringComparison.Ordinal) ||
                methodName.StartsWith("With", StringComparison.Ordinal) ||
                methodName == "WaitFor" ||
                methodName == "RunAsEmulator")
            {
                if (!s_knownAspireMethods.Contains(methodName))
                {
                    warnings.Add($"Unknown Aspire method: {methodName}");
                }
            }
        }

        return warnings;
    }

    private string? GetStructureErrors(string code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return "Code is empty";
        }

        if (!AreBracesBalanced(code))
        {
            return "Unbalanced braces — check for missing { or }";
        }

        if (HasUnclosedStringLiterals(code))
        {
            return "Unclosed string literal — check for missing closing quote";
        }

        return "Code appears to be empty or contains only comments";
    }
}

public record CodeCheckResult(
    bool StructureValid,
    string? StructureErrors,
    List<string> ApiWarnings,
    List<TestCaseCheckResult> TestResults);

public record TestCaseCheckResult(
    string TestId,
    string Name,
    bool Passed,
    string Description,
    string? Detail);
