using System.Text;
using AspireAcademy.Api.Data;
using AspireAcademy.Api.Endpoints;
using AspireAcademy.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();
builder.AddNpgsqlDbContext<AcademyDbContext>("academydb");
builder.AddRedisClient("cache");
builder.Services.AddOpenApi();

// Services
builder.Services.AddScoped<GamificationService>();
builder.Services.AddScoped<CurriculumLoader>();
builder.Services.AddSingleton<AiTutorService>();
builder.Services.AddHttpClient("coderunner", client =>
{
    client.BaseAddress = new Uri(builder.Configuration["services:coderunner:http:0"] ?? "http://localhost:8080");
    client.Timeout = TimeSpan.FromSeconds(60);
});

// JWT authentication
var jwtSecret = builder.Configuration["Jwt:Key"] ?? "dev-secret-key-change-in-production-min-32-chars!!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "AspireAcademy";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactDev", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// Auto-migrate and load curriculum in Development
if (app.Environment.IsDevelopment())
{
    await using var scope = app.Services.CreateAsyncScope();
    var db = scope.ServiceProvider.GetRequiredService<AcademyDbContext>();
    await db.Database.MigrateAsync();

    var loader = scope.ServiceProvider.GetRequiredService<CurriculumLoader>();
    await loader.LoadAsync();

    app.MapOpenApi();
}

app.UseCors("ReactDev");
app.UseAuthentication();
app.UseAuthorization();

app.MapDefaultEndpoints();

// Wire all API endpoint groups
app.MapAuthEndpoints();
app.MapCurriculumEndpoints();
app.MapQuizEndpoints();
app.MapChallengeEndpoints();
app.MapGamificationEndpoints();
app.MapSocialEndpoints();
app.MapAiTutorEndpoints();

app.Run();

public partial class Program { }
