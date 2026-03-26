using Microsoft.Playwright;

namespace AspireAcademy.Api.Tests.Fixtures;

public class AppHostPlaywrightFixture : IAsyncLifetime
{
    private IBrowser? _browser;
    private IPlaywright? _playwright;

    public HttpClient ApiClient { get; private set; } = null!;
    public string WebBaseUrl { get; private set; } = null!;

    public async Task<IPage> NewPageAsync()
    {
        return await _browser!.NewPageAsync();
    }

    public async Task InitializeAsync()
    {
        // Resolve base URLs from env vars or defaults
        var apiUrl = Environment.GetEnvironmentVariable("E2E_API_URL") ?? "http://localhost:5187";
        var webUrl = Environment.GetEnvironmentVariable("E2E_WEB_URL") ?? "http://localhost:60526";

        ApiClient = new HttpClient { BaseAddress = new Uri(apiUrl) };
        ApiClient.DefaultRequestHeaders.Add("X-Test-Client", "true");
        WebBaseUrl = webUrl;

        // Wait for API to be healthy (up to 30 seconds)
        for (var i = 0; i < 30; i++)
        {
            try
            {
                var resp = await ApiClient.GetAsync("/health");
                if (resp.IsSuccessStatusCode)
                {
                    break;
                }
            }
            catch
            {
                // API not ready yet
            }

            await Task.Delay(1000);
        }

        // Install and launch Playwright Chromium
        Microsoft.Playwright.Program.Main(["install", "chromium"]);
        _playwright = await Playwright.CreateAsync();
        _browser = await _playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = true,
        });
    }

    public async Task DisposeAsync()
    {
        if (_browser is not null)
        {
            await _browser.DisposeAsync();
        }

        _playwright?.Dispose();
        ApiClient?.Dispose();
    }
}

[CollectionDefinition("AppHost")]
public class AppHostCollection : ICollectionFixture<AppHostPlaywrightFixture>
{
}
