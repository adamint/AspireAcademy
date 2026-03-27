using System.Net;
using System.Net.Http.Json;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

public class CertificateEndpointsTests : TestFixture
{
    [Fact]
    public async Task GetCertificates_WithAuth_ReturnsWorldProgress()
    {
        using var client = CreateAuthenticatedClient(TestUserId);

        var response = await client.GetAsync("/api/certificates");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await ReadJsonAsync<CertificatesResponse>(response);

        body.Should().NotBeNull();
        body!.Certificates.Should().HaveCountGreaterThanOrEqualTo(2); // world-1 and world-2
        body.DisplayName.Should().Be("Test User");
        body.AllWorldsComplete.Should().BeFalse(); // no lessons completed

        var w1 = body.Certificates.First(c => c.WorldId == "world-1");
        w1.TotalLessons.Should().BeGreaterThan(0);
        w1.LessonsCompleted.Should().Be(0);
        w1.IsComplete.Should().BeFalse();
    }

    [Fact]
    public async Task GetCertificates_AfterCompletingAllLessonsInWorld_ShowsComplete()
    {
        // Complete all lessons in world-1 (mod-1: learn-1, quiz-1, challenge-1)
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();

        var world1Lessons = db.Lessons
            .Where(l => l.Module!.WorldId == "world-1")
            .Select(l => l.Id)
            .ToList();

        foreach (var lessonId in world1Lessons)
        {
            db.UserProgress.Add(new AspireAcademy.Api.Models.UserProgress
            {
                Id = Guid.NewGuid(),
                UserId = TestUserId,
                LessonId = lessonId,
                Status = "completed",
                XpEarned = 50,
                CompletedAt = DateTime.UtcNow
            });
        }
        await db.SaveChangesAsync();

        using var client = CreateAuthenticatedClient(TestUserId);
        var response = await client.GetAsync("/api/certificates");
        var body = await ReadJsonAsync<CertificatesResponse>(response);

        var w1 = body!.Certificates.First(c => c.WorldId == "world-1");
        w1.IsComplete.Should().BeTrue();
        w1.CompletedAt.Should().NotBeNull();
        w1.LessonsCompleted.Should().Be(w1.TotalLessons);
    }

    [Fact]
    public async Task GetCertificates_WithoutAuth_Returns401()
    {
        var response = await Client.GetAsync("/api/certificates");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
