// ----------------------------------------
// Program.cs – Working Example
// UTF-8 Encoded
// ----------------------------------------

// 1. Using directives must be at the top
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// 2. Add services
builder.Services.AddControllers(); // Controller support
builder.Services.AddEndpointsApiExplorer(); // Required for Swagger
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "My ERP API",
        Version = "v1",
        Description = "ERP system API"
    });
});

var app = builder.Build();

// 3. Middleware (Application Pipeline)
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();       // Swagger JSON
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "My ERP API V1");
        c.RoutePrefix = string.Empty; // Open browser at https://localhost:5001/
    });
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers(); // API endpoints are mapped here

app.Run();
