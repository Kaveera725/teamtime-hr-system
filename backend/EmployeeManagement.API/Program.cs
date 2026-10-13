using System.Text;
using EmployeeManagement.API.Data;
using EmployeeManagement.API.Extensions;
using EmployeeManagement.API.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Serilog structured console logging
    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext()
        .WriteTo.Console());

    // EF Core + Npgsql Database context
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseNpgsql(
            builder.Configuration.GetConnectionString("DefaultConnection"),
            npgsql => npgsql.MigrationsAssembly("EmployeeManagement.API")
        )
    );

    // Consistent DI registration pattern for application services
    builder.Services.AddApplicationServices(builder.Configuration);

    // CORS configuration limited to configured frontend origins
    var corsOriginsConfig = builder.Configuration["Cors:AllowedOrigins"]
        ?? builder.Configuration["Cors__AllowedOrigins"]
        ?? "http://localhost:5173,http://localhost:3000";

    var allowedOrigins = corsOriginsConfig
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("FrontendCorsPolicy", policy =>
        {
            policy.WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        });
    });

    // JWT Authentication configuration
    var jwtKey = builder.Configuration["Jwt:Key"]
        ?? builder.Configuration["Jwt__Key"]
        ?? "super_secret_jwt_key_that_is_at_least_32_characters_long_for_security";
    var jwtIssuer = builder.Configuration["Jwt:Issuer"]
        ?? builder.Configuration["Jwt__Issuer"]
        ?? "EmployeeManagementAPI";
    var jwtAudience = builder.Configuration["Jwt:Audience"]
        ?? builder.Configuration["Jwt__Audience"]
        ?? "EmployeeManagementWeb";

    builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });

    builder.Services.AddAuthorization();

    // Controllers and RFC 7807 Model Validation response
    builder.Services.AddControllers()
        .ConfigureApiBehaviorOptions(options =>
        {
            options.InvalidModelStateResponseFactory = context =>
            {
                var problemDetails = new ValidationProblemDetails(context.ModelState)
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Validation Failed",
                    Detail = "One or more validation errors occurred.",
                    Instance = context.HttpContext.Request.Path
                };
                return new BadRequestObjectResult(problemDetails)
                {
                    ContentTypes = { "application/problem+json" }
                };
            };
        });

    builder.Services.AddEndpointsApiExplorer();

    // Swagger with JWT Bearer support
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new OpenApiInfo
        {
            Title = "Employee Leave & Attendance Management API",
            Version = "v1",
            Description = "API for Employee Leave & Attendance Management System (NFR-04, NFR-08)"
        });

        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
            Name = "Authorization",
            In = ParameterLocation.Header,
            Type = SecuritySchemeType.Http,
            Scheme = "Bearer",
            BearerFormat = "JWT"
        });

        c.AddSecurityRequirement(document => new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference("Bearer", document)] = []
        });
    });

    var app = builder.Build();

    // Global exception middleware returning RFC 7807 ProblemDetails
    app.UseMiddleware<ExceptionMiddleware>();

    app.UseSerilogRequestLogging();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "Employee Management API v1");
            c.RoutePrefix = "swagger";
        });
    }

    app.UseCors("FrontendCorsPolicy");
    app.UseAuthentication();
    app.UseAuthorization();
    app.MapControllers();

    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
