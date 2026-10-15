using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.RateLimiting;
using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Auth;
using EmployeeManagement.API.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;
using Xunit;

namespace EmployeeManagement.Tests.IntegrationTests;

[CollectionDefinition("IntegrationTests")]
public class IntegrationTestCollection : ICollectionFixture<CustomWebApplicationFactory>
{
}

public class CustomWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private PostgreSqlContainer? _postgresContainer;
    private readonly object _initLock = new();
    private string _connectionString = string.Empty;
    private bool _initialized;

    public string ConnectionString => _connectionString;

    private void EnsureInitialized()
    {
        if (_initialized) return;
        lock (_initLock)
        {
            if (_initialized) return;

            if (string.IsNullOrEmpty(_connectionString))
            {
                try
                {
                    _postgresContainer = new PostgreSqlBuilder("postgres:16-alpine")
                        .WithDatabase("employee_management_test")
                        .WithUsername("postgres")
                        .WithPassword("postgres")
                        .Build();

                    _postgresContainer.StartAsync().GetAwaiter().GetResult();
                    _connectionString = _postgresContainer.GetConnectionString();
                }
                catch
                {
                    _postgresContainer = null;
                    _connectionString = "Host=localhost;Port=5432;Database=employee_management_test;Username=postgres;Password=postgres";
                }
            }

            Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", _connectionString);
            Environment.SetEnvironmentVariable("Jwt__Key", "PBfS9OwUO+etMDI8mmtJYxx/uRHwIv2n7ak5L1KoCPsKdRfHCvWJSQmGFSYirwL4");
            Environment.SetEnvironmentVariable("Jwt__Issuer", "EmployeeManagement");
            Environment.SetEnvironmentVariable("Jwt__Audience", "EmployeeManagementUsers");
            Environment.SetEnvironmentVariable("Seed__AdminEmail", "admin@company.com");
            Environment.SetEnvironmentVariable("Seed__AdminPassword", "admin123");
            Environment.SetEnvironmentVariable("Attendance__LateAfter", "09:00");
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");

            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseNpgsql(_connectionString)
                .Options;

            using var dbContext = new ApplicationDbContext(options);
            dbContext.Database.Migrate();

            _initialized = true;
        }
    }

    public Task InitializeAsync()
    {
        EnsureInitialized();
        return Task.CompletedTask;
    }

    public new async Task DisposeAsync()
    {
        if (_postgresContainer != null)
        {
            await _postgresContainer.DisposeAsync();
        }

        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        EnsureInitialized();

        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = _connectionString,
                ["Jwt:Key"] = "PBfS9OwUO+etMDI8mmtJYxx/uRHwIv2n7ak5L1KoCPsKdRfHCvWJSQmGFSYirwL4",
                ["Jwt:Issuer"] = "EmployeeManagement",
                ["Jwt:Audience"] = "EmployeeManagementUsers",
                ["Jwt:ExpiryMinutes"] = "60",
                ["Seed:AdminEmail"] = "admin@company.com",
                ["Seed:AdminPassword"] = "admin123",
                ["Attendance:LateAfter"] = "09:00"
            });
        });

        builder.ConfigureServices(services =>
        {
            // Replace DbContext to guarantee it points to the test database
            var dbDescriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            if (dbDescriptor != null)
            {
                services.Remove(dbDescriptor);
            }

            services.AddDbContext<ApplicationDbContext>(options =>
            {
                options.UseNpgsql(_connectionString, npgsql => npgsql.MigrationsAssembly("EmployeeManagement.API"));
            });
        });

        builder.UseEnvironment("Testing");
    }

    public ApplicationDbContext CreateDbContext()
    {
        var scope = Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    }

    public async Task<HttpClient> CreateAuthenticatedClientAsync(string email, string password)
    {
        var client = CreateClient();
        var loginPayload = new LoginRequestDto
        {
            Email = email,
            Password = password
        };

        var response = await client.PostAsync("/api/auth/login",
            new StringContent(JsonSerializer.Serialize(loginPayload), Encoding.UTF8, "application/json"));

        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var token = doc.RootElement.GetProperty("token").GetString();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public async Task<(User user, Employee employee)> CreateUserAndEmployeeAsync(
        string email,
        string password,
        UserRole role,
        long departmentId,
        EmployeeStatus status = EmployeeStatus.ACTIVE)
    {
        using var scope = Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var user = new User
        {
            Email = email.ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = role,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var code = "EMP-" + Guid.NewGuid().ToString("N")[..6].ToUpper();
        var employee = new Employee
        {
            UserId = user.Id,
            DepartmentId = departmentId,
            EmployeeCode = code,
            FirstName = "Test",
            LastName = role.ToString(),
            Position = "Staff",
            Status = status,
            JoinedDate = DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-6)),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Employees.Add(employee);
        await context.SaveChangesAsync();

        return (user, employee);
    }
}
