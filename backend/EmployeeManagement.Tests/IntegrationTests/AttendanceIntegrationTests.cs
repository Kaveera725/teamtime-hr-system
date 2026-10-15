using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EmployeeManagement.API.DTOs.Attendance;
using EmployeeManagement.API.Models;
using Xunit;

namespace EmployeeManagement.Tests.IntegrationTests;

/// <summary>
/// Integration tests for Attendance scenarios:
/// - Scenario 1: Check in 08:30 and check out 17:15 produces PRESENT (FR-ATT-01, FR-ATT-02, FR-ATT-03, Section 12.1.1).
/// - Scenario 2: Check in after 09:00 is recorded as LATE (BR-11, FR-ATT-03, Section 12.1.2).
/// - Scenario 3: Second check-in on the same day is rejected with 409 (BR-10, NFR-03, Section 12.1.3).
/// - Scenario 9: Employee calling another employee's attendance endpoint receives 403 (NFR-02, Section 12.1.9).
/// - Security: Manager cannot access attendance of another department's employee (403, Section 12 Security).
/// </summary>
[Collection("IntegrationTests")]
public class AttendanceIntegrationTests
{
    private readonly CustomWebApplicationFactory _factory;

    public AttendanceIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Scenario1_CheckInAt0830_AndCheckOutAt1715_ProducesPresentRecord_Covers_Section12_1_1()
    {
        var email = $"emp_att1_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";
        await _factory.CreateUserAndEmployeeAsync(email, password, UserRole.EMPLOYEE, 1);
        var client = await _factory.CreateAuthenticatedClientAsync(email, password);

        // 2026-10-15 is Thursday (working day), local time 08:30 and 17:15
        var checkInTimestamp = DateTime.SpecifyKind(new DateTime(2026, 10, 15, 8, 30, 0), DateTimeKind.Local);
        var checkOutTimestamp = DateTime.SpecifyKind(new DateTime(2026, 10, 15, 17, 15, 0), DateTimeKind.Local);

        // 1. Check in at 08:30
        var checkInReq = new CheckInRequestDto
        {
            Notes = "Morning check-in",
            CheckInTime = checkInTimestamp
        };
        var checkInRes = await client.PostAsJsonAsync("/api/attendance/check-in", checkInReq);
        Assert.Equal(HttpStatusCode.Created, checkInRes.StatusCode);

        var checkInBody = await checkInRes.Content.ReadAsStringAsync();
        using var checkInDoc = JsonDocument.Parse(checkInBody);
        Assert.Equal("PRESENT", checkInDoc.RootElement.GetProperty("status").GetString());

        // 2. Check out at 17:15
        var checkOutReq = new CheckOutRequestDto
        {
            Notes = "Evening check-out",
            CheckOutTime = checkOutTimestamp
        };
        var checkOutRes = await client.PostAsJsonAsync("/api/attendance/check-out", checkOutReq);
        Assert.Equal(HttpStatusCode.OK, checkOutRes.StatusCode);

        var checkOutBody = await checkOutRes.Content.ReadAsStringAsync();
        using var checkOutDoc = JsonDocument.Parse(checkOutBody);
        Assert.Equal("PRESENT", checkOutDoc.RootElement.GetProperty("status").GetString());
        Assert.NotNull(checkOutDoc.RootElement.GetProperty("checkOut").GetString());
        Assert.True(checkOutDoc.RootElement.GetProperty("workedHours").GetDouble() >= 8.0);
    }

    [Fact]
    public async Task Scenario2_CheckInAfter0900_IsRecordedAsLate_Covers_Section12_1_2()
    {
        var email = $"emp_late_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";
        await _factory.CreateUserAndEmployeeAsync(email, password, UserRole.EMPLOYEE, 1);
        var client = await _factory.CreateAuthenticatedClientAsync(email, password);

        // 2026-10-15 09:30 local time -> after 09:00 threshold (BR-11)
        var lateCheckIn = DateTime.SpecifyKind(new DateTime(2026, 10, 15, 9, 30, 0), DateTimeKind.Local);

        var checkInReq = new CheckInRequestDto
        {
            Notes = "Traffic delay",
            CheckInTime = lateCheckIn
        };
        var response = await client.PostAsJsonAsync("/api/attendance/check-in", checkInReq);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("LATE", doc.RootElement.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Scenario3_SecondCheckInOnSameDay_RejectedWith409Conflict_Covers_Section12_1_3()
    {
        var email = $"emp_dup_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";
        await _factory.CreateUserAndEmployeeAsync(email, password, UserRole.EMPLOYEE, 1);
        var client = await _factory.CreateAuthenticatedClientAsync(email, password);

        var checkInTime = new DateTime(2026, 10, 15, 8, 45, 0, DateTimeKind.Utc);
        var firstReq = new CheckInRequestDto { CheckInTime = checkInTime };

        var firstRes = await client.PostAsJsonAsync("/api/attendance/check-in", firstReq);
        Assert.Equal(HttpStatusCode.Created, firstRes.StatusCode);

        // Second check-in on the same day (BR-10, unique constraint + friendly 409)
        var secondReq = new CheckInRequestDto { CheckInTime = checkInTime.AddMinutes(5) };
        var secondRes = await client.PostAsJsonAsync("/api/attendance/check-in", secondReq);

        Assert.Equal(HttpStatusCode.Conflict, secondRes.StatusCode);
        var body = await secondRes.Content.ReadAsStringAsync();
        Assert.Contains("already checked in", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Scenario9_EmployeeCallingAnotherEmployeesAttendance_Receives403Forbidden_Covers_Section12_1_9()
    {
        var emp1Email = $"emp1_{Guid.NewGuid():N}@company.com";
        var emp2Email = $"emp2_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";

        var (_, emp1) = await _factory.CreateUserAndEmployeeAsync(emp1Email, password, UserRole.EMPLOYEE, 1);
        var (_, emp2) = await _factory.CreateUserAndEmployeeAsync(emp2Email, password, UserRole.EMPLOYEE, 1);

        var clientEmp1 = await _factory.CreateAuthenticatedClientAsync(emp1Email, password);

        // Employee 1 attempts to call GET /api/attendance/employee/{emp2.Id}
        var response = await clientEmp1.GetAsync($"/api/attendance/employee/{emp2.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Manager_CannotAccessAnotherDepartmentsAttendance_Receives403Forbidden_Covers_Section12_Security()
    {
        var mgrEmail = $"mgr_dept1_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";

        // Manager of Department 1 (IT)
        var (_, mgrEmp) = await _factory.CreateUserAndEmployeeAsync(mgrEmail, password, UserRole.MANAGER, 1);
        using (var db = _factory.CreateDbContext())
        {
            var dept1 = await db.Departments.FindAsync(1L);
            if (dept1 != null)
            {
                dept1.ManagerId = mgrEmp.Id;
                await db.SaveChangesAsync();
            }
        }

        // Employee in Department 2 (HR)
        var otherEmpEmail = $"emp_dept2_{Guid.NewGuid():N}@company.com";
        var (_, otherEmp) = await _factory.CreateUserAndEmployeeAsync(otherEmpEmail, password, UserRole.EMPLOYEE, 2);

        var mgrClient = await _factory.CreateAuthenticatedClientAsync(mgrEmail, password);

        // Manager 1 attempts to view attendance of Department 2 employee
        var response = await mgrClient.GetAsync($"/api/attendance/employee/{otherEmp.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
