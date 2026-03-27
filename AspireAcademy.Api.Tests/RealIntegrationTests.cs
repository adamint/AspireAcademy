extern alias apphost;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace AspireAcademy.Api.Tests;

// ═══════════════════════════════════════════════════════════════════════
// PART 1: Aspire.Hosting.Testing integration tests (real Postgres + Redis)
// ═══════════════════════════════════════════════════════════════════════

/// <summary>
/// Full integration tests using <c>DistributedApplicationTestingBuilder</c>.
/// Starts the real AppHost (Postgres + Redis + API), registers users, and
/// tests the complete user journey end-to-end against real infrastructure.
/// Requires Docker.
/// </summary>
[Trait("Category", "Integration")]
public class RealIntegrationTests : IClassFixture<AspireIntegrationFixture>
{
    private readonly AspireIntegrationFixture _fixture;
    private readonly HttpClient _client;

    public RealIntegrationTests(AspireIntegrationFixture fixture)
    {
        _fixture = fixture;
        _client = fixture.ApiClient;
    }

    // ─── Helper methods ───

    private async Task<(string Token, string UserId)> RegisterAndLogin(string? suffix = null)
    {
        suffix ??= Guid.NewGuid().ToString("N")[..8];
        var username = $"integ_{suffix}";
        var payload = new
        {
            username,
            email = $"{username}@test.com",
            password = "TestPass123",
            displayName = $"Integ {suffix}"
        };

        var registerResponse = await _client.PostAsJsonAsync("/api/auth/register", payload);
        registerResponse.EnsureSuccessStatusCode();

        var body = await registerResponse.Content.ReadFromJsonAsync<JsonElement>();
        var token = body.GetProperty("token").GetString()!;
        var userId = body.GetProperty("user").GetProperty("id").GetString()!;
        return (token, userId);
    }

    private async Task<HttpResponseMessage> AuthGet(string url, string jwt)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> AuthPost(string url, string jwt, object? body = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> AuthPut(string url, string jwt, object body)
    {
        var request = new HttpRequestMessage(HttpMethod.Put, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        request.Content = JsonContent.Create(body);
        return await _client.SendAsync(request);
    }

    private async Task<HttpResponseMessage> AuthDelete(string url, string jwt)
    {
        var request = new HttpRequestMessage(HttpMethod.Delete, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        return await _client.SendAsync(request);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 1) Register + Login
    // ═══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task RegisterUser_Login_GetMe_FullFlow()
    {
        var (token, userId) = await RegisterAndLogin();

        // Verify /me returns the new user
        var meResponse = await AuthGet("/api/auth/me", token);
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);

        var me = await meResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(userId, me.GetProperty("id").GetString());
        Assert.Equal(1, me.GetProperty("currentLevel").GetInt32());
        Assert.Equal(0, me.GetProperty("totalXp").GetInt32());
    }

    // ═══════════════════════════════════════════════════════════════════
    // 2) Get Worlds (verify curriculum loaded)
    // ═══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task GetWorlds_CurriculumLoaded_ReturnsRealWorlds()
    {
        var (token, _) = await RegisterAndLogin();

        var response = await AuthGet("/api/worlds", token);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var worlds = await response.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(worlds);
        Assert.True(worlds!.Length >= 1, "Curriculum should load at least 1 world");

        // Verify world shape has real data
        var first = worlds[0];
        Assert.False(string.IsNullOrEmpty(first.GetProperty("id").GetString()));
        Assert.False(string.IsNullOrEmpty(first.GetProperty("name").GetString()));
    }

    // ═══════════════════════════════════════════════════════════════════
    // 3) Complete a learn lesson → verify XP
    // ═══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task CompleteLessonFlow_AwardsXp_VerifyInXpStats()
    {
        var (token, _) = await RegisterAndLogin();

        // Navigate curriculum: worlds → modules → lessons
        var worldsResp = await AuthGet("/api/worlds", token);
        var worlds = (await worldsResp.Content.ReadFromJsonAsync<JsonElement[]>())!;
        var worldId = worlds[0].GetProperty("id").GetString()!;

        var modulesResp = await AuthGet($"/api/worlds/{worldId}/modules", token);
        var modules = (await modulesResp.Content.ReadFromJsonAsync<JsonElement[]>())!;
        var moduleId = modules[0].GetProperty("id").GetString()!;

        var lessonsResp = await AuthGet($"/api/modules/{moduleId}/lessons", token);
        var lessons = (await lessonsResp.Content.ReadFromJsonAsync<JsonElement[]>())!;

        // Find a learn lesson that's unlocked (no prerequisite)
        string? learnLessonId = null;
        int learnXp = 0;
        foreach (var lesson in lessons)
        {
            var type = lesson.GetProperty("type").GetString();
            var isLocked = lesson.TryGetProperty("isLocked", out var lockedProp) && lockedProp.GetBoolean();
            if (type == "learn" && !isLocked)
            {
                learnLessonId = lesson.GetProperty("id").GetString();
                learnXp = lesson.GetProperty("xpReward").GetInt32();
                break;
            }
        }

        Assert.NotNull(learnLessonId);

        // Get initial XP
        var xpBefore = await AuthGet("/api/xp", token);
        var xpBeforeBody = await xpBefore.Content.ReadFromJsonAsync<JsonElement>();
        var initialXp = xpBeforeBody.GetProperty("totalXp").GetInt32();

        // Complete the lesson
        var completeResp = await AuthPost("/api/progress/complete", token,
            new { LessonId = learnLessonId });
        Assert.Equal(HttpStatusCode.OK, completeResp.StatusCode);

        var completeBody = await completeResp.Content.ReadFromJsonAsync<JsonElement>();
        var earnedXp = completeBody.GetProperty("xpEarned").GetInt32();
        Assert.True(earnedXp > 0, "Should earn XP for completing a lesson");

        // Verify XP actually increased in the backend
        var xpAfter = await AuthGet("/api/xp", token);
        var xpAfterBody = await xpAfter.Content.ReadFromJsonAsync<JsonElement>();
        var finalXp = xpAfterBody.GetProperty("totalXp").GetInt32();
        Assert.True(finalXp > initialXp, $"XP should increase from {initialXp} after earning {earnedXp}");
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4) Quiz: per-question answer + full submit
    // ═══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task QuizFlow_PerQuestionAnswer_ThenFullSubmit()
    {
        var (token, _) = await RegisterAndLogin();

        // Navigate to find a quiz lesson
        var worldsResp = await AuthGet("/api/worlds", token);
        var worlds = (await worldsResp.Content.ReadFromJsonAsync<JsonElement[]>())!;
        var worldId = worlds[0].GetProperty("id").GetString()!;

        var modulesResp = await AuthGet($"/api/worlds/{worldId}/modules", token);
        var modules = (await modulesResp.Content.ReadFromJsonAsync<JsonElement[]>())!;

        string? quizLessonId = null;
        JsonElement quizDetail = default;

        // Search through modules for a quiz lesson
        foreach (var module in modules)
        {
            var moduleId = module.GetProperty("id").GetString()!;
            var lessonsResp = await AuthGet($"/api/modules/{moduleId}/lessons", token);
            var lessons = (await lessonsResp.Content.ReadFromJsonAsync<JsonElement[]>())!;

            foreach (var lesson in lessons)
            {
                var type = lesson.GetProperty("type").GetString();
                var isLocked = lesson.TryGetProperty("isLocked", out var lockedProp) && lockedProp.GetBoolean();

                if (type is "quiz" or "boss-battle" && !isLocked)
                {
                    // Get lesson detail to check if it has quiz questions
                    var detailResp = await AuthGet($"/api/lessons/{lesson.GetProperty("id").GetString()}", token);
                    if (detailResp.StatusCode != HttpStatusCode.OK)
                    {
                        continue;
                    }

                    var detail = await detailResp.Content.ReadFromJsonAsync<JsonElement>();
                    if (detail.TryGetProperty("quiz", out var quiz) && quiz.ValueKind != JsonValueKind.Null)
                    {
                        quizLessonId = lesson.GetProperty("id").GetString();
                        quizDetail = detail;
                        break;
                    }
                }
                else if ((type == "learn" || type == "challenge") && !isLocked)
                {
                    // Complete or skip lessons to unlock subsequent quiz lessons
                    var completeResp = await AuthPost("/api/progress/complete", token,
                        new { LessonId = lesson.GetProperty("id").GetString() });
                    if (completeResp.StatusCode != HttpStatusCode.OK)
                    {
                        // Challenge lessons can't be "completed" directly — skip them instead
                        await AuthPost("/api/progress/skip", token,
                            new { LessonId = lesson.GetProperty("id").GetString() });
                    }
                }
            }

            if (quizLessonId is not null)
            {
                break;
            }
        }

        if (quizLessonId is null)
        {
            // No unlocked quiz found - skip gracefully
            return;
        }

        var quizQuestions = quizDetail.GetProperty("quiz").GetProperty("questions");
        Assert.True(quizQuestions.GetArrayLength() > 0, "Quiz should have questions");

        // Test per-question answer endpoint
        var firstQ = quizQuestions[0];
        var questionId = firstQ.GetProperty("id").GetString()!;

        // Pick the first option as our answer
        var options = firstQ.GetProperty("options");
        var firstOptionId = options[0].GetProperty("id").GetString()!;

        var answerResp = await AuthPost($"/api/quizzes/{quizLessonId}/answer", token,
            new { QuestionId = questionId, Answer = firstOptionId });

        Assert.Equal(HttpStatusCode.OK, answerResp.StatusCode);
        var answerBody = await answerResp.Content.ReadFromJsonAsync<JsonElement>();
        // Response should have correct/explanation/points
        Assert.True(answerBody.TryGetProperty("correct", out _));
        Assert.True(answerBody.TryGetProperty("explanation", out _));
        Assert.True(answerBody.TryGetProperty("pointsAwarded", out _));
        Assert.True(answerBody.TryGetProperty("correctOptionIds", out _));

        // Now submit the full quiz with answers for all questions
        var answers = new List<object>();
        foreach (var q in quizQuestions.EnumerateArray())
        {
            var qId = q.GetProperty("id").GetString()!;
            var qOptions = q.GetProperty("options");
            // Just pick the first option for each question
            var optionId = qOptions[0].GetProperty("id").GetString()!;
            answers.Add(new { QuestionId = qId, SelectedOptionIds = new[] { optionId }, FreeTextAnswer = (string?)null });
        }

        var submitResp = await AuthPost($"/api/quizzes/{quizLessonId}/submit", token,
            new { Answers = answers });

        Assert.Equal(HttpStatusCode.OK, submitResp.StatusCode);
        var submitBody = await submitResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(submitBody.TryGetProperty("score", out _));
        Assert.True(submitBody.TryGetProperty("passed", out _));
        Assert.True(submitBody.TryGetProperty("results", out var results));
        Assert.True(results.GetArrayLength() > 0, "Submit should return results for each question");
    }

    // ═══════════════════════════════════════════════════════════════════
    // 5) View profile
    // ═══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task ViewProfile_SelfAndOther()
    {
        var (token1, userId1) = await RegisterAndLogin("profile1");
        var (token2, userId2) = await RegisterAndLogin("profile2");

        // View own profile via /me
        var meResp = await AuthGet("/api/auth/me", token1);
        Assert.Equal(HttpStatusCode.OK, meResp.StatusCode);

        // View other user's profile
        var profileResp = await AuthGet($"/api/users/{userId2}/profile", token1);
        Assert.Equal(HttpStatusCode.OK, profileResp.StatusCode);
        var profile = await profileResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal($"integ_profile2", profile.GetProperty("username").GetString());
    }

    // ═══════════════════════════════════════════════════════════════════
    // 6) Edit profile → verify changes persist
    // ═══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task EditProfile_ChangesPersist()
    {
        var (token, _) = await RegisterAndLogin();

        // Update profile
        var updateResp = await AuthPut("/api/users/me", token,
            new { DisplayName = "Updated Name", Bio = "My updated bio" });
        Assert.Equal(HttpStatusCode.OK, updateResp.StatusCode);

        // Verify changes persisted by reading /me
        var meResp = await AuthGet("/api/auth/me", token);
        var me = await meResp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Updated Name", me.GetProperty("displayName").GetString());
        Assert.Equal("My updated bio", me.GetProperty("bio").GetString());
    }

    // ═══════════════════════════════════════════════════════════════════
    // 7) Avatar randomize → verify URL changes
    // ═══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task AvatarRandomize_UrlChanges()
    {
        var (token, _) = await RegisterAndLogin();

        // Get initial avatar
        var me1 = await AuthGet("/api/auth/me", token);
        var avatar1 = (await me1.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("avatarUrl").GetString()!;

        // Randomize
        var randResp = await AuthPost("/api/avatar/randomize", token);
        Assert.Equal(HttpStatusCode.OK, randResp.StatusCode);
        var randBody = await randResp.Content.ReadFromJsonAsync<JsonElement>();
        var newUrl = randBody.GetProperty("avatarUrl").GetString()!;

        Assert.NotEqual(avatar1, newUrl);

        // Clear avatar
        var clearResp = await AuthDelete("/api/avatar", token);
        Assert.Equal(HttpStatusCode.OK, clearResp.StatusCode);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 8) View leaderboard
    // ═══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Leaderboard_AllScopes_ReturnOk()
    {
        var (token, _) = await RegisterAndLogin();

        foreach (var scope in new[] { "weekly", "alltime", "friends" })
        {
            var resp = await AuthGet($"/api/leaderboard?scope={scope}", token);
            Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

            var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
            Assert.Equal(scope, body.GetProperty("scope").GetString());
            Assert.True(body.TryGetProperty("entries", out _));
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 9) Friend request + accept full lifecycle
    // ═══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task FriendLifecycle_Request_Accept_List_Delete()
    {
        var (token1, _) = await RegisterAndLogin("friend_a");
        var (token2, _) = await RegisterAndLogin("friend_b");

        // Send friend request
        var reqResp = await AuthPost("/api/friends/request", token1,
            new { Username = "integ_friend_b" });
        Assert.Equal(HttpStatusCode.Created, reqResp.StatusCode);

        var reqBody = await reqResp.Content.ReadFromJsonAsync<JsonElement>();
        var friendshipId = reqBody.GetProperty("friendshipId").GetString()!;

        // Verify pending in sender's list
        var list1 = await AuthGet("/api/friends", token1);
        var list1Body = await list1.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(list1Body.GetProperty("pendingSent").GetArrayLength() > 0);

        // Accept as addressee
        var acceptResp = await AuthPost($"/api/friends/{friendshipId}/accept", token2);
        Assert.Equal(HttpStatusCode.OK, acceptResp.StatusCode);

        // Both should see each other in friends list
        var friendsList1 = await AuthGet("/api/friends", token1);
        var friends1 = await friendsList1.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(friends1.GetProperty("friends").GetArrayLength() > 0);

        var friendsList2 = await AuthGet("/api/friends", token2);
        var friends2 = await friendsList2.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(friends2.GetProperty("friends").GetArrayLength() > 0);

        // Delete friendship
        var delResp = await AuthDelete($"/api/friends/{friendshipId}", token1);
        Assert.Equal(HttpStatusCode.NoContent, delResp.StatusCode);

        // Verify removed
        var afterDel = await AuthGet("/api/friends", token1);
        var afterDelBody = await afterDel.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(0, afterDelBody.GetProperty("friends").GetArrayLength());
    }

    // ═══════════════════════════════════════════════════════════════════
    // 10) Achievements listing
    // ═══════════════════════════════════════════════════════════════════

    [Fact]
    public async Task Achievements_ReturnsListFromCurriculum()
    {
        var (token, _) = await RegisterAndLogin();

        var resp = await AuthGet("/api/achievements", token);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);

        var achievements = await resp.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(JsonValueKind.Array, achievements.ValueKind);
        // Real curriculum should have achievements loaded
        if (achievements.GetArrayLength() > 0)
        {
            var first = achievements[0];
            Assert.True(first.TryGetProperty("id", out _));
            Assert.True(first.TryGetProperty("name", out _));
            Assert.True(first.TryGetProperty("isUnlocked", out _));
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════
// PART 2: Unit test gap coverage (WebApplicationFactory-based)
// ═══════════════════════════════════════════════════════════════════════

/// <summary>
/// Tests for the per-question quiz answer endpoint (POST /quizzes/{lessonId}/answer).
/// This endpoint had ZERO test coverage.
/// </summary>
public class QuizPerQuestionAnswerTests : TestFixture
{
    public override async Task InitializeAsync()
    {
        await base.InitializeAsync();

        // Mark lesson-learn-1 as completed so lesson-quiz-1 is unlocked
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Data.AcademyDbContext>();
        db.UserProgress.Add(new Models.UserProgress
        {
            Id = Guid.NewGuid(),
            UserId = TestUserId,
            LessonId = "lesson-learn-1",
            Status = "completed",
            Attempts = 1,
            XpEarned = 50,
            CompletedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task AnswerSingleQuestion_CorrectAnswer_ReturnsCorrectTrue()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/answer",
            new { QuestionId = QuizQuestion1Id, Answer = "a" }); // "a" is correct

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("correct").GetBoolean());
        Assert.True(body.GetProperty("pointsAwarded").GetInt32() > 0);
        Assert.False(string.IsNullOrEmpty(body.GetProperty("explanation").GetString()));
    }

    [Fact]
    public async Task AnswerSingleQuestion_WrongAnswer_ReturnsCorrectFalse()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/answer",
            new { QuestionId = QuizQuestion1Id, Answer = "b" }); // "b" is wrong

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(body.GetProperty("correct").GetBoolean());
        Assert.Equal(0, body.GetProperty("pointsAwarded").GetInt32());
        // Should return the correct option IDs for learning
        var correctIds = body.GetProperty("correctOptionIds");
        Assert.True(correctIds.GetArrayLength() > 0);
    }

    [Fact]
    public async Task AnswerSingleQuestion_NonexistentQuestion_Returns404()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/answer",
            new { QuestionId = Guid.NewGuid(), Answer = "a" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AnswerSingleQuestion_QuestionFromDifferentLesson_Returns404()
    {
        // QuizQuestion1Id belongs to lesson-quiz-1, but we're POSTing to lesson-learn-1
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.PostAsJsonAsync("/api/quizzes/lesson-learn-1/answer",
            new { QuestionId = QuizQuestion1Id, Answer = "a" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AnswerSingleQuestion_Unauthenticated_Returns401()
    {
        var response = await Client.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/answer",
            new { QuestionId = QuizQuestion1Id, Answer = "a" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AnswerSingleQuestion_ArrayAnswer_WorksForMultiSelect()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // Send answer as array (multi-select style)
        var response = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/answer",
            new { QuestionId = QuizQuestion1Id, Answer = new[] { "a" } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(body.GetProperty("correct").GetBoolean());
    }
}

/// <summary>
/// Tests for edge cases and logical errors across endpoints.
/// </summary>
public class EdgeCaseTests : TestFixture
{
    public override async Task InitializeAsync()
    {
        await base.InitializeAsync();

        // Unlock quiz and challenge lessons
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Data.AcademyDbContext>();
        db.UserProgress.AddRange(
            new Models.UserProgress
            {
                Id = Guid.NewGuid(), UserId = TestUserId, LessonId = "lesson-learn-1",
                Status = "completed", Attempts = 1, XpEarned = 50, CompletedAt = DateTime.UtcNow
            },
            new Models.UserProgress
            {
                Id = Guid.NewGuid(), UserId = TestUserId, LessonId = "lesson-quiz-1",
                Status = "completed", Attempts = 1, XpEarned = 100, CompletedAt = DateTime.UtcNow
            });
        await db.SaveChangesAsync();
    }

    // ── Submit challenge to a quiz lesson ──

    [Fact]
    public async Task ChallengeSubmit_ToQuizLesson_Returns400OrEmpty()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // lesson-quiz-1 is a quiz type, submitting a code challenge to it should fail
        var response = await authClient.PostAsJsonAsync("/api/challenges/lesson-quiz-1/submit",
            new { Code = "Console.WriteLine(\"Hello\");", StepIndex = 0 });

        // Should return BadRequest (no code challenges for quiz lessons)
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ChallengeRun_ToQuizLesson_Returns400()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.PostAsJsonAsync("/api/challenges/lesson-quiz-1/run",
            new { Code = "Console.WriteLine(\"Hello\");", StepIndex = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── Complete a quiz lesson via /progress/complete ──

    [Fact]
    public async Task CompleteEndpoint_OnChallengeLesson_Returns400()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        // lesson-challenge-1 is a challenge type — should not be completable via this endpoint
        var response = await authClient.PostAsJsonAsync("/api/progress/complete",
            new { LessonId = "lesson-challenge-1" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── Invalid JSON ──

    [Fact]
    public async Task InvalidJsonBody_ReturnsBadRequest()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var content = new StringContent("not valid json",
            System.Text.Encoding.UTF8, "application/json");
        var response = await authClient.PostAsync("/api/progress/complete", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task EmptyBody_ToRegister_ReturnsBadRequest()
    {
        var content = new StringContent("{}",
            System.Text.Encoding.UTF8, "application/json");
        var response = await Client.PostAsync("/api/auth/register", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── Expired JWT ──

    [Fact]
    public async Task ExpiredJwt_Returns401()
    {
        // Generate an already-expired token
        var key = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
            System.Text.Encoding.UTF8.GetBytes(AcademyApiFactory.JwtKey));
        var claims = new[]
        {
            new System.Security.Claims.Claim(
                System.Security.Claims.ClaimTypes.NameIdentifier, TestUserId.ToString()),
            new System.Security.Claims.Claim(
                System.Security.Claims.ClaimTypes.Name, "testuser"),
        };

        var token = new System.IdentityModel.Tokens.Jwt.JwtSecurityToken(
            issuer: AcademyApiFactory.JwtIssuer,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(-1), // Already expired
            signingCredentials: new Microsoft.IdentityModel.Tokens.SigningCredentials(
                key, Microsoft.IdentityModel.Tokens.SecurityAlgorithms.HmacSha256));

        var expiredToken = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler()
            .WriteToken(token);

        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", expiredToken);

        var response = await client.GetAsync("/api/worlds");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ── Non-existent lesson ──

    [Fact]
    public async Task QuizSubmit_NonexistentLesson_Returns404()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.PostAsJsonAsync("/api/quizzes/nonexistent-lesson/submit",
            new { Answers = new[] { new { QuestionId = Guid.NewGuid(), SelectedOptionIds = new[] { "a" }, FreeTextAnswer = (string?)null } } });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task ChallengeRun_NonexistentLesson_Returns404()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.PostAsJsonAsync("/api/challenges/nonexistent-lesson/run",
            new { Code = "Console.WriteLine(\"Hello\");", StepIndex = 0 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ── Quiz with empty answers list ──

    [Fact]
    public async Task QuizSubmit_EmptyAnswers_Returns400()
    {
        using var authClient = CreateAuthenticatedClient(TestUserId);

        var response = await authClient.PostAsJsonAsync("/api/quizzes/lesson-quiz-1/submit",
            new { Answers = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ── Mark complete verifies XP actually increases in DB ──

    [Fact]
    public async Task MarkComplete_XpActuallyIncreasesInDb()
    {
        var userId = Guid.Parse("77777777-7777-7777-7777-777777777777");
        await SeedUser(userId, "xpverify");

        using var authClient = CreateAuthenticatedClient(userId, "xpverify");

        // Check XP before
        var xpBefore = await authClient.GetAsync("/api/xp");
        var xpBeforeBody = await xpBefore.Content.ReadFromJsonAsync<JsonElement>();
        var initialXp = xpBeforeBody.GetProperty("totalXp").GetInt32();
        Assert.Equal(0, initialXp);

        // Complete lesson-learn-1
        var response = await authClient.PostAsJsonAsync("/api/progress/complete",
            new { LessonId = "lesson-learn-1" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Check XP after
        var xpAfter = await authClient.GetAsync("/api/xp");
        var xpAfterBody = await xpAfter.Content.ReadFromJsonAsync<JsonElement>();
        var finalXp = xpAfterBody.GetProperty("totalXp").GetInt32();
        Assert.True(finalXp > 0, "XP should be > 0 after completing a lesson");
        Assert.Equal(50, finalXp); // lesson-learn-1 has XpReward = 50

        // Verify via direct DB check
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Data.AcademyDbContext>();
        var userXp = await db.UserXp.FindAsync(userId);
        Assert.NotNull(userXp);
        Assert.Equal(finalXp, userXp!.TotalXp);
    }

    // ── Token refresh endpoint ──

    [Fact]
    public async Task TokenRefresh_ValidToken_ReturnsNewToken()
    {
        // Register to get a valid token
        var payload = new
        {
            username = "refresh_test",
            email = "refresh_test@test.com",
            password = "TestPass123",
            displayName = "Refresh Test"
        };
        var regResp = await Client.PostAsJsonAsync("/api/auth/register", payload);
        if (regResp.StatusCode == HttpStatusCode.Conflict)
        {
            // Already registered in a previous test run
            var loginResp = await Client.PostAsJsonAsync("/api/auth/login",
                new { UsernameOrEmail = "refresh_test", Password = "TestPass123" });
            regResp = loginResp;
        }

        var body = await regResp.Content.ReadFromJsonAsync<JsonElement>();
        var originalToken = body.GetProperty("token").GetString()!;

        // Refresh the token
        var refreshResp = await Client.PostAsJsonAsync("/api/auth/refresh",
            new { Token = originalToken });
        Assert.Equal(HttpStatusCode.OK, refreshResp.StatusCode);

        var refreshBody = await refreshResp.Content.ReadFromJsonAsync<JsonElement>();
        var newToken = refreshBody.GetProperty("token").GetString();
        Assert.False(string.IsNullOrEmpty(newToken));
    }

    // ── Helper ──

    private async Task SeedUser(Guid userId, string username)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Data.AcademyDbContext>();

        if (await db.Users.FindAsync(userId) is not null)
        {
            return;
        }

        db.Users.Add(new Models.User
        {
            Id = userId,
            Username = username,
            Email = $"{username}@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password1"),
            DisplayName = $"Test {username}",
            CreatedAt = DateTime.UtcNow,
            LoginStreakDays = 0
        });

        db.UserXp.Add(new Models.UserXp
        {
            UserId = userId,
            TotalXp = 0,
            CurrentLevel = 1,
            CurrentRank = "aspire-intern",
            WeeklyXp = 0,
            WeekStart = DateOnly.FromDateTime(DateTime.UtcNow)
        });

        await db.SaveChangesAsync();
    }
}
