var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .AddDatabase("academydb");

var redis = builder.AddRedis("cache");

var api = builder.AddProject<Projects.AspireAcademy_Api>("api")
    .WithReference(postgres)
    .WithReference(redis)
    .WaitFor(postgres)
    .WaitFor(redis);

builder.Build().Run();
