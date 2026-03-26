using System.Diagnostics;

namespace AspireAcademy.Api.Telemetry;

public static class AcademyTracing
{
    public static readonly ActivitySource Source = new("AspireAcademy.Api");
}
