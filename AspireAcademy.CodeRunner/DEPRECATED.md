# AspireAcademy.CodeRunner — DEPRECATED

> **This component is deprecated.** Code validation is now handled by the
> `CodeCheckerService` (a lightweight static checker that runs inside the API
> process). The Docker-based CodeRunner was retired because of recurring issues
> with SDK version mismatches, .NET workload problems, and out-of-memory errors
> in constrained containers.

The source files are kept here in case real compilation / execution support is
needed in the future (e.g., behind a feature flag or for advanced challenges).

## What replaced it

`AspireAcademy.Api/Services/CodeCheckerService.cs` — validates student code
**without compilation** by running structural checks (balanced braces, unclosed
strings), Aspire API-name validation, and the existing `code-contains` /
`code-pattern` test-case types. Test cases that require runtime output
(`output-equals`, `output-contains`) are marked as "skipped — requires runtime".
