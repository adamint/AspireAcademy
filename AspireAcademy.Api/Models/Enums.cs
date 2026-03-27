namespace AspireAcademy.Api.Models;

public static class LessonTypes
{
    public const string Learn = "learn";
    public const string Quiz = "quiz";
    public const string Challenge = "challenge";
    public const string BossBattle = "boss-battle";
    public const string BuildProject = "build-project";
}

public static class ProgressStatuses
{
    public const string NotStarted = "not-started";
    public const string InProgress = "in-progress";
    public const string Completed = "completed";
    public const string Perfect = "perfect";
    public const string Skipped = "skipped";
}

public static class FriendshipStatuses
{
    public const string Pending = "pending";
    public const string Accepted = "accepted";
}

public static class Ranks
{
    public const string AspireIntern = "aspire-intern";
    public const string AspireDeveloper = "aspire-developer";
    public const string AspireEngineer = "aspire-engineer";
    public const string AspireSpecialist = "aspire-specialist";
    public const string AspireExpert = "aspire-expert";
    public const string AspireMaster = "aspire-master";
    public const string AspireArchitect = "aspire-architect";
}

public static class PersonaTypes
{
    public const string DevOps = "devops";
    public const string CSharp = "csharp";
    public const string JavaScript = "javascript";
    public const string Polyglot = "polyglot";

    public static readonly string[] All = [DevOps, CSharp, JavaScript, Polyglot];
}

public static class PersonaRelevance
{
    public const string High = "high";
    public const string Medium = "medium";
    public const string Low = "low";
    public const string Skip = "skip";
}
