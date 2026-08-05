using Microsoft.EntityFrameworkCore;
using MyERPWeb.Data; // DbContext'in bulunduğu klasör

var builder = WebApplication.CreateBuilder(args);

// ---------------------------
// 1️⃣ Connection String ve DbContext
// ---------------------------
builder.Services.AddDbContext<MyERPDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// ---------------------------
// 2️⃣ Controller ve Swagger
// ---------------------------
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ---------------------------
// 3️⃣ CORS
// ---------------------------
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// ---------------------------
// 4️⃣ Swagger sadece Development modunda
// ---------------------------
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ---------------------------
// 5️⃣ CORS ve HTTPS
// ---------------------------
app.UseCors("AllowAll");
app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
