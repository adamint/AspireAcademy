using System.Net;
using System.Text;
using System.Text.Json;

namespace AspireAcademy.Api.Tests;

/// <summary>
/// Fake HTTP handler that simulates the CodeRunner service.
/// </summary>
public sealed class FakeCodeRunnerHandler : HttpMessageHandler
{
    public bool CompilationSuccess { get; set; } = true;
    public string Output { get; set; } = "Hello World\n";
    public string Error { get; set; } = "";

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = JsonSerializer.Serialize(new
        {
            success = CompilationSuccess,
            output = CompilationSuccess ? Output : "",
            error = CompilationSuccess ? "" : Error
        });

        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        });
    }

    public void Reset()
    {
        CompilationSuccess = true;
        Output = "Hello World\n";
        Error = "";
    }
}
