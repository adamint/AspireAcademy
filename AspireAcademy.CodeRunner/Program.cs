using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
using System.Text.Json;

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
        var result = await compilationService.ExecuteAsync(request.Code, request.Packages, timeout);
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

record ExecuteRequest(string Code, string[]? Packages, int? TimeoutSeconds);
record ExecuteResponse(bool Success, string Output, string Error);

// --- Compilation Service ---

sealed class CompilationService(ILogger logger)
{
    private static readonly SemaphoreSlim s_semaphore = new(5, 5);

    private static readonly HashSet<string> s_allowedPackages = new(StringComparer.OrdinalIgnoreCase)
    {
        "Newtonsoft.Json",
        "System.Text.Json",
        "CsvHelper",
        "Dapper",
        "AutoMapper",
        "FluentValidation",
        "Humanizer",
        "MediatR",
        "Polly",
        "Bogus",
        "BenchmarkDotNet",
        "xunit",
        "FluentAssertions",
        "Moq",
        "Microsoft.Extensions.Logging.Abstractions",
        "Microsoft.Extensions.DependencyInjection",
    };

    public async Task<ExecuteResponse> ExecuteAsync(string code, string[]? packages, int timeoutSeconds)
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

            WriteCsproj(tempDir, validatedPackages.Packages);
            await File.WriteAllTextAsync(Path.Combine(tempDir, "Program.cs"), code);

            var buildResult = await RunProcessAsync("dotnet", "build -c Release --nologo -v q", tempDir, timeoutSeconds);
            if (buildResult.ExitCode != 0)
            {
                var errors = ParseBuildErrors(buildResult.Output + buildResult.ErrorOutput);
                return new ExecuteResponse(false, "", $"Build failed:\n{errors}");
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

    private static void WriteCsproj(string dir, List<string> packages)
    {
        var sb = new StringBuilder();
        sb.AppendLine("""
            <Project Sdk="Microsoft.NET.Sdk">
              <PropertyGroup>
                <OutputType>Exe</OutputType>
                <TargetFramework>net9.0</TargetFramework>
                <ImplicitUsings>enable</ImplicitUsings>
                <Nullable>enable</Nullable>
              </PropertyGroup>
            """);

        if (packages.Count > 0)
        {
            sb.AppendLine("  <ItemGroup>");
            foreach (var pkg in packages)
            {
                sb.AppendLine($"    <PackageReference Include=\"{pkg}\" Version=\"*\" />");
            }
            sb.AppendLine("  </ItemGroup>");
        }

        sb.AppendLine("</Project>");
        File.WriteAllText(Path.Combine(dir, "UserCode.csproj"), sb.ToString());
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
        if (output.Length <= maxLength)
        {
            return output;
        }

        return output[..maxLength] + "\n... (output truncated)";
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
}

record ProcessResult(int ExitCode, string Output, string ErrorOutput);
