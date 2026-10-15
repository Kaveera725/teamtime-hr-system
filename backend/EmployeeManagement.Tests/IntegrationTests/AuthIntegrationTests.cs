using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using EmployeeManagement.API.DTOs.Auth;
using EmployeeManagement.API.DTOs.Department;
using EmployeeManagement.API.Models;
using Xunit;

namespace EmployeeManagement.Tests.IntegrationTests;

/// <summary>
/// Integration tests for Authentication, Account Status, and Role Enforcement
/// (FR-AUTH-01, FR-AUTH-02, FR-AUTH-03, FR-AUTH-05, NFR-02, Section 12 Integration).
/// </summary>
[Collection("IntegrationTests")]
public class AuthIntegrationTests
{
    private readonly CustomWebApplicationFactory _factory;

    public AuthIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Login_ValidCredentials_Returns200AndJwtToken_Covers_FR_AUTH_01()
    {
        var client = _factory.CreateClient();
        var email = $"user_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";

        await _factory.CreateUserAndEmployeeAsync(email, password, UserRole.EMPLOYEE, 1);

        var loginDto = new LoginRequestDto { Email = email, Password = password };
        var response = await client.PostAsJsonAsync("/api/auth/login", loginDto);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.True(doc.RootElement.TryGetProperty("token", out var tokenProp));
        Assert.False(string.IsNullOrWhiteSpace(tokenProp.GetString()));

        Assert.True(doc.RootElement.TryGetProperty("user", out var userProp));
        Assert.Equal(email.ToLowerInvariant(), userProp.GetProperty("email").GetString());
        Assert.Equal("EMPLOYEE", userProp.GetProperty("role").GetString());
    }

    [Fact]
    public async Task Login_InvalidPassword_Returns401Unauthorized_Covers_FR_AUTH_01()
    {
        var client = _factory.CreateClient();
        var email = $"user_{Guid.NewGuid():N}@company.com";
        await _factory.CreateUserAndEmployeeAsync(email, "CorrectPass123!", UserRole.EMPLOYEE, 1);

        var loginDto = new LoginRequestDto { Email = email, Password = "WrongPassword!" };
        var response = await client.PostAsJsonAsync("/api/auth/login", loginDto);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_DeactivatedUser_Returns401Unauthorized_Covers_FR_AUTH_05()
    {
        var client = _factory.CreateClient();
        var email = $"deactivated_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";

        // User is created with EmployeeStatus.INACTIVE
        await _factory.CreateUserAndEmployeeAsync(email, password, UserRole.EMPLOYEE, 1, EmployeeStatus.INACTIVE);

        var loginDto = new LoginRequestDto { Email = email, Password = password };
        var response = await client.PostAsJsonAsync("/api/auth/login", loginDto);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("deactivated", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RoleEnforcement_AdminEndpoint_ForbiddenForEmployee_Covers_NFR_02()
    {
        var email = $"emp_forbidden_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";
        await _factory.CreateUserAndEmployeeAsync(email, password, UserRole.EMPLOYEE, 1);

        var employeeClient = await _factory.CreateAuthenticatedClientAsync(email, password);

        // POST /api/departments requires Admin
        var newDept = new CreateDepartmentRequestDto { Name = $"Dept_{Guid.NewGuid():N}" };
        var response = await employeeClient.PostAsJsonAsync("/api/departments", newDept);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task RoleEnforcement_AdminEndpoint_AllowedForAdmin_Covers_FR_AUTH_02()
    {
        var email = $"admin_allowed_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";
        await _factory.CreateUserAndEmployeeAsync(email, password, UserRole.ADMIN, 1);

        var adminClient = await _factory.CreateAuthenticatedClientAsync(email, password);

        var deptName = "Dept_" + Guid.NewGuid().ToString("N")[..8];
        var response = await adminClient.PostAsJsonAsync("/api/departments", new CreateDepartmentRequestDto { Name = deptName });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task GetCurrentUser_ReturnsAuthenticatedProfile_Covers_FR_AUTH_03()
    {
        var email = $"me_test_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";
        var (_, emp) = await _factory.CreateUserAndEmployeeAsync(email, password, UserRole.EMPLOYEE, 1);

        var client = await _factory.CreateAuthenticatedClientAsync(email, password);
        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal(emp.EmployeeCode, doc.RootElement.GetProperty("employeeCode").GetString());
    }
}
