using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using EmployeeManagement.API.Data;
using EmployeeManagement.API.Extensions;
using EmployeeManagement.API.Middleware;
using EmployeeManagement.API.Models;
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

    // EF Core + Npgsql
    builder.Services.AddDbContext<ApplicationDbContext>(options =>
        options.UseNpgsql(
            builder.Configuration.GetConnectionString("DefaultConnection"),
            npgsql => npgsql.MigrationsAssembly("EmployeeManagement.API")
        )
    );

    // Application services (DI registration pattern)
    builder.Services.AddApplicationServices(builder.Configuration);

    // Health checks (NFR-04): includes a database connectivity check
    builder.Services.AddHealthChecks()
        .AddDbContextCheck<ApplicationDbContext>("database");

    // CORS limited to the configured frontend origins.
    // Environment variable Cors__AllowedOrigins maps to Cors:AllowedOrigins automatically.
    var corsOriginsConfig = builder.Configuration["Cors:AllowedOrigins"]
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

    // Rate limiting for the login endpoint (Section 9), counted per client IP
    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.AddPolicy("LoginPolicy", httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    Window = TimeSpan.FromMinutes(1),
                    PermitLimit = builder.Environment.IsEnvironment("Testing") ? 10000 : 10,
                    QueueLimit = 0
                }));
    });

    // JWT settings: no hard-coded fallbacks in production. Testing environment provides test defaults.
    var jwtKey = builder.Configuration["Jwt:Key"]
        ?? (builder.Environment.IsEnvironment("Testing")
            ? "PBfS9OwUO+etMDI8mmtJYxx/uRHwIv2n7ak5L1KoCPsKdRfHCvWJSQmGFSYirwL4"
            : throw new InvalidOperationException(
                "Jwt:Key is not configured. Set it with: dotnet user-secrets set \"Jwt:Key\" \"<32+ characters>\""));
    if (jwtKey.Length < 32)
        throw new InvalidOperationException("Jwt:Key must be at least 32 characters long.");

    var jwtIssuer = builder.Configuration["Jwt:Issuer"]
        ?? (builder.Environment.IsEnvironment("Testing") ? "EmployeeManagement" : throw new InvalidOperationException("Jwt:Issuer is not configured."));
    var jwtAudience = builder.Configuration["Jwt:Audience"]
        ?? (builder.Environment.IsEnvironment("Testing") ? "EmployeeManagementUsers" : throw new InvalidOperationException("Jwt:Audience is not configured."));


    builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false; // local development; enforce HTTPS in production
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
            ClockSkew = TimeSpan.Zero,
            // AuthService must write the role using ClaimTypes.Role
            RoleClaimType = ClaimTypes.Role
        };

        // 401 and 403 as RFC 7807 ProblemDetails
        options.Events = new JwtBearerEvents
        {
            OnChallenge = async context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/problem+json";
                var problem = new ProblemDetails
                {
                    Status = StatusCodes.Status401Unauthorized,
                    Title = "Unauthorized",
                    Detail = "You must be signed in with a valid token to access this resource.",
                    Instance = context.Request.Path
                };
                await context.Response.WriteAsync(JsonSerializer.Serialize(problem));
            },
            OnForbidden = async context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/problem+json";
                var problem = new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Forbidden",
                    Detail = "You do not have permission to perform this action.",
                    Instance = context.Request.Path
                };
                await context.Response.WriteAsync(JsonSerializer.Serialize(problem));
            }
        };
    });

    // Role policies: Admin, Manager, Employee
    builder.Services.AddAuthorization(options =>
    {
        options.AddPolicy("AdminOnly", policy => policy.RequireRole(UserRole.ADMIN.ToString()));
        options.AddPolicy("ManagerOnly", policy => policy.RequireRole(UserRole.MANAGER.ToString()));
        options.AddPolicy("EmployeeOnly", policy => policy.RequireRole(UserRole.EMPLOYEE.ToString()));
        options.AddPolicy("ManagerOrAdmin", policy => policy.RequireRole(
            UserRole.MANAGER.ToString(), UserRole.ADMIN.ToString()));
    });

    // Controllers and RFC 7807 validation responses
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
            Description = "API for Employee Leave & Attendance Management System"
        });

        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Description = "JWT Authorization header using the Bearer scheme. Paste only the token.",
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

    // Global exception middleware (RFC 7807). Keep it first.
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
    app.UseRateLimiter();
    app.UseAuthentication();
    app.UseAuthorization();

    app.MapControllers();
    app.MapHealthChecks("/health");

    // Automatically apply pending EF Core migrations on startup (outside test environments)
    if (!app.Environment.IsEnvironment("Testing"))
    {
        try
        {
            using var scope = app.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.Database.MigrateAsync();
        }
        catch (Exception ex)
        {
            Log.Error(ex, "An error occurred while applying database migrations.");
            throw;
        }
    }

    // Seed the first administrator if none exists (Section 7.10, 9).
    try
    {
        await DbSeeder.SeedAdminAsync(app.Services, app.Configuration);
    }
    catch (Exception ex)
    {
        throw new InvalidOperationException(
            "Admin seeding failed. Have you applied the migrations? Run: dotnet ef database update", ex);
    }

    // Development-only demo data seed command (e.g. dotnet run -- seed-demo)
    var isSeedDemoCommand = args.Contains("seed-demo", StringComparer.OrdinalIgnoreCase)
        || args.Contains("--seed-demo", StringComparer.OrdinalIgnoreCase);

    if (isSeedDemoCommand)
    {
        if (!app.Environment.IsDevelopment())
        {
            Log.Error("Demo data seeding is restricted strictly to Development environment.");
            Environment.ExitCode = 1;
            return;
        }

        var success = await DemoDataSeeder.SeedDemoDataAsync(app.Services, app.Configuration, app.Environment);
        Environment.ExitCode = success ? 0 : 1;
        return;
    }

    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

public partial class Program { }