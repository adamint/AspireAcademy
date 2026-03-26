using System.Diagnostics.Metrics;

namespace AspireAcademy.Api.Telemetry;

public static class AcademyMetrics
{
    public static readonly Meter Meter = new("AspireAcademy.Api");

    public static readonly Counter<long> UsersRegistered = Meter.CreateCounter<long>("academy.users.registered");
    public static readonly Counter<long> LoginsTotal = Meter.CreateCounter<long>("academy.logins.total");
    public static readonly Counter<long> LessonsCompleted = Meter.CreateCounter<long>("academy.lessons.completed");
    public static readonly Counter<long> QuizzesSubmitted = Meter.CreateCounter<long>("academy.quizzes.submitted");
    public static readonly Counter<long> ChallengesSubmitted = Meter.CreateCounter<long>("academy.challenges.submitted");
    public static readonly Counter<long> XpAwarded = Meter.CreateCounter<long>("academy.xp.awarded");
    public static readonly Counter<long> AchievementsUnlocked = Meter.CreateCounter<long>("academy.achievements.unlocked");
    public static readonly Counter<long> CodeRunnerExecutions = Meter.CreateCounter<long>("academy.coderunner.executions");
    public static readonly Histogram<double> CodeRunnerDurationMs = Meter.CreateHistogram<double>("academy.coderunner.duration_ms");
    public static readonly Histogram<double> QuizScorePercent = Meter.CreateHistogram<double>("academy.quiz.score_percent");
}
