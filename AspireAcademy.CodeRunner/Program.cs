using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

var compilationService = new CompilationService(app.Logger);

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapPost("/execute", async (ExecuteRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Code))
    {
        return Results.BadRequest(new ExecuteResponse(false, "", "Code cannot be empty."));
    }

    var timeout = request.TimeoutSeconds is > 0 and <= 60 ? request.TimeoutSeconds.Value : 30;

    try
    {
        var result = await compilationService.ExecuteAsync(
            request.Code,
            request.Language ?? "csharp",
            request.Packages,
            request.StubProjects,
            timeout);
        return Results.Ok(result);
    }
    catch (TimeoutException)
    {
        return Results.Ok(new ExecuteResponse(false, "", "Execution timed out."));
    }
    catch (Exception ex)
    {
        return Results.Problem($"Internal error: {ex.Message}");
    }
});

app.Run();

// --- Models ---

record ExecuteRequest(
    string Code,
    string? Language,
    string[]? Packages,
    string[]? StubProjects,
    int? TimeoutSeconds);

record ExecuteResponse(bool Success, string Output, string Error);

// --- Compilation Service ---

sealed partial class CompilationService(ILogger logger)
{
    private static readonly SemaphoreSlim s_semaphore = new(5, 5);

    private static readonly HashSet<string> s_allowedPackages = new(StringComparer.OrdinalIgnoreCase)
    {
        // Aspire hosting packages
        "Aspire.Hosting",
        "Aspire.Hosting.AppHost",
        "Aspire.Hosting.PostgreSQL",
        "Aspire.Hosting.SqlServer",
        "Aspire.Hosting.MySql",
        "Aspire.Hosting.MongoDB",
        "Aspire.Hosting.Oracle",
        "Aspire.Hosting.Redis",
        "Aspire.Hosting.Garnet",
        "Aspire.Hosting.Valkey",
        "Aspire.Hosting.RabbitMQ",
        "Aspire.Hosting.Kafka",
        "Aspire.Hosting.Nats",
        "Aspire.Hosting.Seq",
        "Aspire.Hosting.Keycloak",
        "Aspire.Hosting.Qdrant",
        "Aspire.Hosting.Milvus",
        "Aspire.Hosting.OpenAI",
        "Aspire.Hosting.Orleans",
        "Aspire.Hosting.Yarp",
        "Aspire.Hosting.Python",
        "Aspire.Hosting.JavaScript",
        "Aspire.Hosting.Docker",
        "Aspire.Hosting.Testing",
        // Aspire client integration packages
        "Aspire.Npgsql.EntityFrameworkCore.PostgreSQL",
        "Aspire.Npgsql",
        "Aspire.MongoDB.Driver",
        "Aspire.StackExchange.Redis",
        "Aspire.StackExchange.Redis.DistributedCaching",
        "Aspire.RabbitMQ.Client",
        // Common .NET packages
        "Microsoft.Extensions.Logging.Abstractions",
        "Microsoft.Extensions.DependencyInjection",
        "Microsoft.Extensions.Http.Resilience",
        "Microsoft.Extensions.ServiceDiscovery",
        // OpenTelemetry packages
        "OpenTelemetry.Extensions.Hosting",
        "OpenTelemetry.Instrumentation.AspNetCore",
        "OpenTelemetry.Instrumentation.Http",
        "OpenTelemetry.Instrumentation.Runtime",
    };

    public async Task<ExecuteResponse> ExecuteAsync(
        string code, string language, string[]? packages, string[]? stubProjects, int timeoutSeconds)
    {
        if (!await s_semaphore.WaitAsync(TimeSpan.FromSeconds(10)))
        {
            return new ExecuteResponse(false, "", "Server is busy. Please try again shortly.");
        }

        var tempDir = Path.Combine(Path.GetTempPath(), $"coderunner-{Guid.NewGuid():N}");

        try
        {
            Directory.CreateDirectory(tempDir);

            var validatedPackages = ValidatePackages(packages);
            if (validatedPackages.Error is not null)
            {
                return new ExecuteResponse(false, "", validatedPackages.Error);
            }

            if (language == "typescript")
            {
                return await ExecuteTypeScriptAsync(code, tempDir, timeoutSeconds);
            }

            // C# execution: scaffold Aspire workspace if needed
            ScaffoldWorkspace(tempDir, code, validatedPackages.Packages, stubProjects);

            // Check if this is Aspire AppHost code (uses single-file format)
            var isAspireAppHost = File.Exists(Path.Combine(tempDir, "apphost.cs"));

            ProcessResult buildResult;
            if (isAspireAppHost)
            {
                // Single-file Aspire: use dotnet run --file which handles #:sdk directives
                // We only need to verify it builds, not actually run the AppHost
                buildResult = await RunProcessAsync("dotnet", "run --file apphost.cs -- --help", tempDir, timeoutSeconds);
            }
            else
            {
                buildResult = await RunProcessAsync("dotnet", "build -c Release --nologo -v q", tempDir, timeoutSeconds);
            }

            if (buildResult.ExitCode != 0)
            {
                var errors = ParseBuildErrors(buildResult.Output + buildResult.ErrorOutput);
                return new ExecuteResponse(false, "", $"Build failed:\n{errors}");
            }

            // For AppHost code that calls Build().Run(), we don't actually run it
            // (it would try to start DCP). Instead, successful compilation = success.
            if (code.Contains("Build().Run()") || code.Contains("Build().RunAsync()"))
            {
                return new ExecuteResponse(true, "Build succeeded! AppHost code compiles correctly.", "");
            }

            var runResult = await RunProcessAsync("dotnet", "run -c Release --no-build --project .", tempDir, timeoutSeconds);

            return new ExecuteResponse(
                runResult.ExitCode == 0,
                TruncateOutput(runResult.Output),
                TruncateOutput(runResult.ErrorOutput));
        }
        catch (OperationCanceledException)
        {
            throw new TimeoutException();
        }
        finally
        {
            s_semaphore.Release();
            CleanupDirectory(tempDir);
        }
    }

    /// <summary>
    /// Scaffolds a workspace that can compile AppHost code with Projects.X references.
    /// Creates stub projects for each referenced project type so the generic type parameters resolve.
    /// </summary>
    private void ScaffoldWorkspace(string dir, string code, List<string> packages, string[]? stubProjects)
    {
        // Detect Projects.X references in the code
        var projectRefs = stubProjects?.ToList() ?? [];
        foreach (Match match in ProjectsRegex().Matches(code))
        {
            var name = match.Groups[1].Value;
            if (!projectRefs.Contains(name))
            {
                projectRefs.Add(name);
            }
        }

        // Sanitize project names — alphanumeric + dots/hyphens only, no path traversal
        projectRefs = projectRefs
            .Where(n => SanitizedNameRegex().IsMatch(n))
            .Take(10)  // limit to 10 stub projects max
            .ToList();

        if (projectRefs.Count > 0)
        {
            foreach (var projName in projectRefs)
            {
                CreateStubProject(dir, projName);
            }
        }

        // Write the AppHost csproj with Aspire SDK and project references
        WriteAppHostCsproj(dir, packages, projectRefs);
        File.WriteAllText(Path.Combine(dir, "Program.cs"), code);

        // Write a Properties/launchSettings.json so Aspire doesn't complain
        var propsDir = Path.Combine(dir, "Properties");
        Directory.CreateDirectory(propsDir);
        File.WriteAllText(Path.Combine(propsDir, "launchSettings.json"), """
            {
              "profiles": {
                "http": {
                  "commandName": "Project",
                  "launchBrowser": false,
                  "environmentVariables": {
                    "ASPNETCORE_ENVIRONMENT": "Development"
                  }
                }
              }
            }
            """);
    }

    private static void CreateStubProject(string workspaceDir, string projectName)
    {
        // Convert PascalCase to kebab for directory: ApiService → ApiService/
        var projectDir = Path.Combine(workspaceDir, projectName);
        Directory.CreateDirectory(projectDir);

        // Minimal web project that compiles
        File.WriteAllText(Path.Combine(projectDir, $"{projectName}.csproj"), """
            <Project Sdk="Microsoft.NET.Sdk.Web">
              <PropertyGroup>
                <TargetFramework>net9.0</TargetFramework>
                <ImplicitUsings>enable</ImplicitUsings>
                <Nullable>enable</Nullable>
              </PropertyGroup>
            </Project>
            """);

        File.WriteAllText(Path.Combine(projectDir, "Program.cs"), """
            var builder = WebApplication.CreateBuilder(args);
            var app = builder.Build();
            app.MapGet("/", () => "Hello");
            app.Run();
            """);
    }

    private static void WriteAppHostCsproj(string dir, List<string> packages, List<string> projectRefs)
    {
        // Use single-file Aspire AppHost format with #:sdk directives
        // This matches how the main app works and doesn't require workloads
        var sb = new StringBuilder();
        sb.AppendLine("#:sdk Aspire.AppHost.Sdk@13.2.0");

        foreach (var pkg in packages)
        {
            if (!string.Equals(pkg, "Aspire.Hosting", StringComparison.OrdinalIgnoreCase) &&
                !string.Equals(pkg, "Aspire.Hosting.AppHost", StringComparison.OrdinalIgnoreCase))
            {
                sb.AppendLine($"#:package {pkg}@13.2.*");
            }
        }

        // For stub projects, use #:project directives
        foreach (var proj in projectRefs)
        {
            sb.AppendLine($"#:project ./{proj}");
        }

        sb.AppendLine();

        // Read the user's code from Program.cs and append it
        var userCode = File.ReadAllText(Path.Combine(dir, "Program.cs"));
        sb.Append(userCode);

        // Write as apphost.cs (replacing Program.cs)
        File.WriteAllText(Path.Combine(dir, "apphost.cs"), sb.ToString());
        File.Delete(Path.Combine(dir, "Program.cs"));

        // Write aspire.config.json
        File.WriteAllText(Path.Combine(dir, "aspire.config.json"), """
            {
              "appHost": {
                "path": "apphost.cs"
              }
            }
            """);
    }

    private async Task<ExecuteResponse> ExecuteTypeScriptAsync(string code, string tempDir, int timeoutSeconds)
    {
        await File.WriteAllTextAsync(Path.Combine(tempDir, "main.ts"), code);
        // Use ts-node directly (pre-installed in container) — avoid npx which may download packages
        var result = await RunProcessAsync("ts-node", "main.ts", tempDir, timeoutSeconds);
        return new ExecuteResponse(
            result.ExitCode == 0,
            TruncateOutput(result.Output),
            TruncateOutput(result.ErrorOutput));
    }

    private (List<string> Packages, string? Error) ValidatePackages(string[]? packages)
    {
        if (packages is null or { Length: 0 })
        {
            return ([], null);
        }

        var validated = new List<string>();
        foreach (var pkg in packages)
        {
            if (!s_allowedPackages.Contains(pkg))
            {
                return ([], $"Package '{pkg}' is not in the allowlist.");
            }
            validated.Add(pkg);
        }

        return (validated, null);
    }

    private async Task<ProcessResult> RunProcessAsync(string fileName, string arguments, string workingDir, int timeoutSeconds)
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));

        var psi = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            WorkingDirectory = workingDir,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        using var process = new Process { StartInfo = psi };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();

        process.OutputDataReceived += (_, e) => { if (e.Data is not null) stdout.AppendLine(e.Data); };
        process.ErrorDataReceived += (_, e) => { if (e.Data is not null) stderr.AppendLine(e.Data); };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        try
        {
            await process.WaitForExitAsync(cts.Token);
        }
        catch (OperationCanceledException)
        {
            try { process.Kill(entireProcessTree: true); } catch { }
            throw;
        }

        return new ProcessResult(process.ExitCode, stdout.ToString(), stderr.ToString());
    }

    private static string ParseBuildErrors(string output)
    {
        var lines = output.Split('\n')
            .Where(l => l.Contains("error CS") || l.Contains("error MSB"))
            .Select(l => l.Trim())
            .Take(10);

        var errors = string.Join('\n', lines);
        return string.IsNullOrWhiteSpace(errors) ? output.Trim() : errors;
    }

    private static string TruncateOutput(string output, int maxLength = 10_000)
    {
        return output.Length <= maxLength ? output : output[..maxLength] + "\n... (output truncated)";
    }

    private void CleanupDirectory(string dir)
    {
        try
        {
            if (Directory.Exists(dir))
            {
                Directory.Delete(dir, recursive: true);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to clean up temp directory: {Dir}", dir);
        }
    }

    [GeneratedRegex(@"Projects\.(\w+)")]
    private static partial Regex ProjectsRegex();

    [GeneratedRegex(@"^[A-Za-z][A-Za-z0-9.\-]{0,49}$")]
    private static partial Regex SanitizedNameRegex();
}

record ProcessResult(int ExitCode, string Output, string ErrorOutput);
