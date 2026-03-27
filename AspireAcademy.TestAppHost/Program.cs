var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .AddDatabase("academydb");

var api = builder.AddProject<Projects.AspireAcademy_Api>("api")
    .WithReference(postgres)
    .WaitFor(postgres)
    .WithEnvironment("Jwt__Key", "integration-test-jwt-key-at-least-32-characters!!");

builder.Build().Run();
