using Microsoft.Playwright;

namespace AspireAcademy.Api.Tests.Fixtures;

/// <summary>
/// Per-class fixture that provides Playwright pages backed by a shared browser singleton.
/// Each test class gets its own fixture instance (with its own HttpClient), but all
/// classes share a single Chromium browser process for efficiency.
/// </summary>
public class AppHostPlaywrightFixture : IAsyncLifetime
{
    private static readonly SemaphoreSlim s_initLock = new(1, 1);
    private static IBrowser? s_browser;
    private static IPlaywright? s_playwright;
    private static bool s_initialized;
    private static int s_refCount;

    public HttpClient ApiClient { get; private set; } = null!;
    public string WebBaseUrl { get; private set; } = null!;
    public string ApiBaseUrl { get; private set; } = null!;

    public async Task<IPage> NewPageAsync()
    {
        // browser.NewPageAsync() creates a context + page pair;
        // closing the page automatically disposes the context.
        return await s_browser!.NewPageAsync();
    }

    /// <summary>
    /// Closes the browser context that owns the given page, releasing resources.
    /// </summary>
    public async Task ClosePageAsync(IPage page)
    {
        await page.CloseAsync();
    }

    public async Task InitializeAsync()
    {
        // Resolve base URLs from env vars or defaults
        var apiUrl = Environment.GetEnvironmentVariable("E2E_API_URL") ?? "http://localhost:5187";
        var webUrl = Environment.GetEnvironmentVariable("E2E_WEB_URL") ?? "http://localhost:60526";

        ApiClient = new HttpClient { BaseAddress = new Uri(apiUrl) };
        ApiClient.DefaultRequestHeaders.Add("X-Test-Client", "true");
        WebBaseUrl = webUrl;
        ApiBaseUrl = apiUrl;

        await EnsureBrowserInitializedAsync(apiUrl, webUrl);
        Interlocked.Increment(ref s_refCount);
    }

    private static async Task EnsureBrowserInitializedAsync(string apiUrl, string webUrl)
    {
        if (s_initialized)
        {
            return;
        }

        await s_initLock.WaitAsync();
        try
        {
            if (s_initialized)
            {
                return;
            }

            // Share base URLs with static helpers (idempotent — all instances use the same values)
            E2E.E2EHelpers.WebBaseUrl = webUrl;
            E2E.E2EHelpers.ApiBaseUrl = apiUrl;

            // Wait for API to be healthy (up to 30 seconds)
            using var healthClient = new HttpClient();
            healthClient.DefaultRequestHeaders.Add("X-Test-Client", "true");
            for (var i = 0; i < 30; i++)
            {
                try
                {
                    var resp = await healthClient.GetAsync(apiUrl + "/health");
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

            // Install and launch Playwright Chromium (once for the entire test run)
            Microsoft.Playwright.Program.Main(["install", "chromium"]);
            s_playwright = await Playwright.CreateAsync();
            s_browser = await s_playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
            {
                Headless = true,
            });

            s_initialized = true;
        }
        finally
        {
            s_initLock.Release();
        }
    }

    public async Task DisposeAsync()
    {
        ApiClient?.Dispose();

        if (Interlocked.Decrement(ref s_refCount) <= 0)
        {
            if (s_browser is not null)
            {
                await s_browser.DisposeAsync();
                s_browser = null;
            }

            s_playwright?.Dispose();
            s_playwright = null;
            s_initialized = false;
        }
    }
}
