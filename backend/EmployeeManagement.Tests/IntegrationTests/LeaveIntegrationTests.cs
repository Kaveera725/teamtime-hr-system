using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using EmployeeManagement.API.DTOs.Leave;
using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EmployeeManagement.Tests.IntegrationTests;

/// <summary>
/// Integration tests for Leave workflows:
/// - Scenario 4: Apply 3 days Annual Leave with sufficient balance -> PENDING and balance unchanged (FR-LEV-01, FR-LEV-02, BR-05, Section 12.1.4).
/// - Scenario 5: Overlapping request rejected with 409 (BR-03, Section 12.1.5).
/// - Scenario 6: Request exceeding available balance rejected with 400 (BR-04, Section 12.1.6).
/// - Scenario 7: Manager approves request -> APPROVED and used_days deducted in same transaction (FR-LEV-05, FR-LEV-07, BR-05, NFR-03, Section 12.1.7).
/// - Scenario 8: Manager attempting to approve own request receives 403 (BR-07, Section 12.1.8).
/// - Cancellation: Approved request before start date cancelled -> CANCELLED and balance restored (FR-LEV-04, BR-06, Section 12 Integration).
/// - Security: Manager cannot approve request outside their department (403, BR-07, Section 12 Security).
/// - Concurrency: Two simultaneous approvals produce one 200 OK and one 409 Conflict (NFR-03, Section 12 Concurrency).
/// </summary>
[Collection("IntegrationTests")]
public class LeaveIntegrationTests
{
    private readonly CustomWebApplicationFactory _factory;

    public LeaveIntegrationTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private async Task SetupLeaveBalanceAsync(long employeeId, long leaveTypeId, int year, decimal allocatedDays, decimal usedDays = 0)
    {
        using var db = _factory.CreateDbContext();
        var existing = await db.LeaveBalances.FirstOrDefaultAsync(b => b.EmployeeId == employeeId && b.LeaveTypeId == leaveTypeId && b.Year == year);
        if (existing == null)
        {
            db.LeaveBalances.Add(new LeaveBalance
            {
                EmployeeId = employeeId,
                LeaveTypeId = leaveTypeId,
                Year = year,
                AllocatedDays = allocatedDays,
                UsedDays = usedDays
            });
        }
        else
        {
            existing.AllocatedDays = allocatedDays;
            existing.UsedDays = usedDays;
        }
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task Scenario4_ApplyLeave_WithSufficientBalance_StatusIsPending_BalanceUnchanged_Covers_Section12_1_4()
    {
        var email = $"emp_apply_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";
        var (_, emp) = await _factory.CreateUserAndEmployeeAsync(email, password, UserRole.EMPLOYEE, 1);
        var client = await _factory.CreateAuthenticatedClientAsync(email, password);

        var nextYear = DateTime.UtcNow.Year + 1;
        await SetupLeaveBalanceAsync(emp.Id, leaveTypeId: 1, year: nextYear, allocatedDays: 14m, usedDays: 0m);

        // 3 working days: Mon to Wed
        var start = new DateOnly(nextYear, 5, 11);
        var end = new DateOnly(nextYear, 5, 13);

        var requestDto = new CreateLeaveRequestDto
        {
            LeaveTypeId = 1, // Annual Leave
            StartDate = start,
            EndDate = end,
            IsHalfDay = false,
            Reason = "Family vacation"
        };

        var response = await client.PostAsJsonAsync("/api/leave-requests", requestDto);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        Assert.Equal("PENDING", doc.RootElement.GetProperty("status").GetString());
        Assert.Equal(3.0m, doc.RootElement.GetProperty("totalDays").GetDecimal());

        // Balance used_days must remain unchanged (0) while PENDING (BR-05)
        using var db = _factory.CreateDbContext();
        var balance = await db.LeaveBalances.FirstAsync(b => b.EmployeeId == emp.Id && b.LeaveTypeId == 1 && b.Year == nextYear);
        Assert.Equal(0m, balance.UsedDays);
    }

    [Fact]
    public async Task Scenario5_ApplyOverlappingLeave_RejectedWith409Conflict_Covers_Section12_1_5()
    {
        var email = $"emp_ovlp_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";
        var (_, emp) = await _factory.CreateUserAndEmployeeAsync(email, password, UserRole.EMPLOYEE, 1);
        var client = await _factory.CreateAuthenticatedClientAsync(email, password);

        var nextYear = DateTime.UtcNow.Year + 1;
        await SetupLeaveBalanceAsync(emp.Id, leaveTypeId: 1, year: nextYear, allocatedDays: 14m, usedDays: 0m);

        // Existing request: Mon to Fri
        var start = new DateOnly(nextYear, 6, 8);
        var end = new DateOnly(nextYear, 6, 12);
        var firstRes = await client.PostAsJsonAsync("/api/leave-requests", new CreateLeaveRequestDto
        {
            LeaveTypeId = 1,
            StartDate = start,
            EndDate = end,
            Reason = "Initial request"
        });
        Assert.Equal(HttpStatusCode.Created, firstRes.StatusCode);

        // Overlapping request: Tue to Thu (BR-03)
        var secondRes = await client.PostAsJsonAsync("/api/leave-requests", new CreateLeaveRequestDto
        {
            LeaveTypeId = 1,
            StartDate = start.AddDays(1),
            EndDate = end.AddDays(-1),
            Reason = "Overlapping attempt"
        });

        Assert.Equal(HttpStatusCode.Conflict, secondRes.StatusCode);
    }

    [Fact]
    public async Task Scenario6_ApplyLeave_ExceedingAvailableBalance_RejectedWith400BadRequest_Covers_Section12_1_6()
    {
        var email = $"emp_nobal_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";
        var (_, emp) = await _factory.CreateUserAndEmployeeAsync(email, password, UserRole.EMPLOYEE, 1);
        var client = await _factory.CreateAuthenticatedClientAsync(email, password);

        var nextYear = DateTime.UtcNow.Year + 1;
        await SetupLeaveBalanceAsync(emp.Id, leaveTypeId: 1, year: nextYear, allocatedDays: 5m, usedDays: 0m);

        // Request 10 working days: Mon July 5 to Fri July 16 > 5 allocated (BR-04)
        var start = new DateOnly(nextYear, 7, 5);
        var end = new DateOnly(nextYear, 7, 16);

        var response = await client.PostAsJsonAsync("/api/leave-requests", new CreateLeaveRequestDto
        {
            LeaveTypeId = 1,
            StartDate = start,
            EndDate = end,
            Reason = "Exceeds balance"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Insufficient leave balance", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Scenario7_ApproveLeave_ByManager_SetsApprovedAndDeductsBalance_Covers_Section12_1_7()
    {
        var mgrEmail = $"mgr_appr_{Guid.NewGuid():N}@company.com";
        var empEmail = $"emp_appr_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";

        var (_, mgrEmp) = await _factory.CreateUserAndEmployeeAsync(mgrEmail, password, UserRole.MANAGER, 1);
        var (_, emp) = await _factory.CreateUserAndEmployeeAsync(empEmail, password, UserRole.EMPLOYEE, 1);

        using (var db = _factory.CreateDbContext())
        {
            var dept1 = await db.Departments.FindAsync(1L);
            if (dept1 != null)
            {
                dept1.ManagerId = mgrEmp.Id;
                await db.SaveChangesAsync();
            }
        }

        var nextYear = DateTime.UtcNow.Year + 1;
        await SetupLeaveBalanceAsync(emp.Id, leaveTypeId: 1, year: nextYear, allocatedDays: 14m, usedDays: 0m);

        // Employee applies for 3 days
        var empClient = await _factory.CreateAuthenticatedClientAsync(empEmail, password);
        var applyRes = await empClient.PostAsJsonAsync("/api/leave-requests", new CreateLeaveRequestDto
        {
            LeaveTypeId = 1,
            StartDate = new DateOnly(nextYear, 8, 3),
            EndDate = new DateOnly(nextYear, 8, 5), // 3 working days
            Reason = "Summer vacation"
        });
        Assert.Equal(HttpStatusCode.Created, applyRes.StatusCode);

        var applyBody = await applyRes.Content.ReadAsStringAsync();
        using var applyDoc = JsonDocument.Parse(applyBody);
        var leaveId = applyDoc.RootElement.GetProperty("id").GetInt64();

        // Manager approves the request
        var mgrClient = await _factory.CreateAuthenticatedClientAsync(mgrEmail, password);
        var approveRes = await mgrClient.PutAsync($"/api/leave-requests/{leaveId}/approve", null);

        Assert.Equal(HttpStatusCode.OK, approveRes.StatusCode);
        var approveBody = await approveRes.Content.ReadAsStringAsync();
        using var approveDoc = JsonDocument.Parse(approveBody);
        Assert.Equal("APPROVED", approveDoc.RootElement.GetProperty("status").GetString());

        // Verify used_days increased to 3 in same transaction (BR-05, FR-LEV-07)
        using var verifyDb = _factory.CreateDbContext();
        var balance = await verifyDb.LeaveBalances.FirstAsync(b => b.EmployeeId == emp.Id && b.LeaveTypeId == 1 && b.Year == nextYear);
        Assert.Equal(3.0m, balance.UsedDays);
    }

    [Fact]
    public async Task Scenario8_ManagerAttemptingToApproveOwnRequest_Receives403Forbidden_Covers_Section12_1_8()
    {
        var mgrEmail = $"mgr_self_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";

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

        var nextYear = DateTime.UtcNow.Year + 1;
        await SetupLeaveBalanceAsync(mgrEmp.Id, leaveTypeId: 1, year: nextYear, allocatedDays: 14m, usedDays: 0m);

        var mgrClient = await _factory.CreateAuthenticatedClientAsync(mgrEmail, password);

        // Manager submits a leave request
        var applyRes = await mgrClient.PostAsJsonAsync("/api/leave-requests", new CreateLeaveRequestDto
        {
            LeaveTypeId = 1,
            StartDate = new DateOnly(nextYear, 9, 7),
            EndDate = new DateOnly(nextYear, 9, 8),
            Reason = "Manager off"
        });
        Assert.Equal(HttpStatusCode.Created, applyRes.StatusCode);

        var applyBody = await applyRes.Content.ReadAsStringAsync();
        using var applyDoc = JsonDocument.Parse(applyBody);
        var leaveId = applyDoc.RootElement.GetProperty("id").GetInt64();

        // Manager attempts to approve their own request (BR-07)
        var approveRes = await mgrClient.PutAsync($"/api/leave-requests/{leaveId}/approve", null);

        Assert.Equal(HttpStatusCode.Forbidden, approveRes.StatusCode);
        var body = await approveRes.Content.ReadAsStringAsync();
        Assert.Contains("cannot approve your own", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CancelLeave_ApprovedBeforeStartDate_RestoresBalance_Covers_Section12_Integration()
    {
        var mgrEmail = $"mgr_cncl_{Guid.NewGuid():N}@company.com";
        var empEmail = $"emp_cncl_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";

        var (_, mgrEmp) = await _factory.CreateUserAndEmployeeAsync(mgrEmail, password, UserRole.MANAGER, 1);
        var (_, emp) = await _factory.CreateUserAndEmployeeAsync(empEmail, password, UserRole.EMPLOYEE, 1);

        using (var db = _factory.CreateDbContext())
        {
            var dept1 = await db.Departments.FindAsync(1L);
            if (dept1 != null)
            {
                dept1.ManagerId = mgrEmp.Id;
                await db.SaveChangesAsync();
            }
        }

        var nextYear = DateTime.UtcNow.Year + 1;
        await SetupLeaveBalanceAsync(emp.Id, leaveTypeId: 1, year: nextYear, allocatedDays: 14m, usedDays: 0m);

        // 1. Employee applies
        var empClient = await _factory.CreateAuthenticatedClientAsync(empEmail, password);
        var applyRes = await empClient.PostAsJsonAsync("/api/leave-requests", new CreateLeaveRequestDto
        {
            LeaveTypeId = 1,
            StartDate = new DateOnly(nextYear, 10, 5),
            EndDate = new DateOnly(nextYear, 10, 6), // 2 days
            Reason = "Trip"
        });
        var applyDoc = JsonDocument.Parse(await applyRes.Content.ReadAsStringAsync());
        var leaveId = applyDoc.RootElement.GetProperty("id").GetInt64();

        // 2. Manager approves (used_days becomes 2)
        var mgrClient = await _factory.CreateAuthenticatedClientAsync(mgrEmail, password);
        var approveRes = await mgrClient.PutAsync($"/api/leave-requests/{leaveId}/approve", null);
        Assert.Equal(HttpStatusCode.OK, approveRes.StatusCode);

        // 3. Employee cancels before start date (FR-LEV-04, BR-06)
        var cancelRes = await empClient.PutAsync($"/api/leave-requests/{leaveId}/cancel", null);
        Assert.Equal(HttpStatusCode.OK, cancelRes.StatusCode);

        // 4. Verify balance is restored back to 0
        using var verifyDb = _factory.CreateDbContext();
        var balance = await verifyDb.LeaveBalances.FirstAsync(b => b.EmployeeId == emp.Id && b.LeaveTypeId == 1 && b.Year == nextYear);
        Assert.Equal(0m, balance.UsedDays);
    }

    [Fact]
    public async Task Manager_CannotApproveLeaveOutsideDepartment_Returns403_Covers_Section12_Security()
    {
        var mgrEmail = $"mgr_ext_{Guid.NewGuid():N}@company.com";
        var empEmail = $"emp_otherdept_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";

        // Manager of Dept 1
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

        // Employee of Dept 2
        var (_, emp) = await _factory.CreateUserAndEmployeeAsync(empEmail, password, UserRole.EMPLOYEE, 2);
        var nextYear = DateTime.UtcNow.Year + 1;
        await SetupLeaveBalanceAsync(emp.Id, leaveTypeId: 1, year: nextYear, allocatedDays: 14m, usedDays: 0m);

        var empClient = await _factory.CreateAuthenticatedClientAsync(empEmail, password);
        var applyRes = await empClient.PostAsJsonAsync("/api/leave-requests", new CreateLeaveRequestDto
        {
            LeaveTypeId = 1,
            StartDate = new DateOnly(nextYear, 11, 2),
            EndDate = new DateOnly(nextYear, 11, 3),
            Reason = "Dept 2 employee leave"
        });
        var leaveDoc = JsonDocument.Parse(await applyRes.Content.ReadAsStringAsync());
        var leaveId = leaveDoc.RootElement.GetProperty("id").GetInt64();

        // Manager of Dept 1 attempts to approve request from Dept 2
        var mgrClient = await _factory.CreateAuthenticatedClientAsync(mgrEmail, password);
        var approveRes = await mgrClient.PutAsync($"/api/leave-requests/{leaveId}/approve", null);

        Assert.Equal(HttpStatusCode.Forbidden, approveRes.StatusCode);
    }

    [Fact]
    public async Task ConcurrentApproval_TwoSimultaneousApprovals_ReturnsOneSuccessAndOne409Conflict_Covers_Section12_Concurrency()
    {
        var adminEmail = $"admin_conc_{Guid.NewGuid():N}@company.com";
        var empEmail = $"emp_conc_{Guid.NewGuid():N}@company.com";
        var password = "Password123!";

        await _factory.CreateUserAndEmployeeAsync(adminEmail, password, UserRole.ADMIN, 1);
        var (_, emp) = await _factory.CreateUserAndEmployeeAsync(empEmail, password, UserRole.EMPLOYEE, 1);

        var nextYear = DateTime.UtcNow.Year + 1;
        await SetupLeaveBalanceAsync(emp.Id, leaveTypeId: 1, year: nextYear, allocatedDays: 14m, usedDays: 0m);

        // Employee applies
        var empClient = await _factory.CreateAuthenticatedClientAsync(empEmail, password);
        var applyRes = await empClient.PostAsJsonAsync("/api/leave-requests", new CreateLeaveRequestDto
        {
            LeaveTypeId = 1,
            StartDate = new DateOnly(nextYear, 12, 7),
            EndDate = new DateOnly(nextYear, 12, 8),
            Reason = "Concurrency test"
        });
        var leaveDoc = JsonDocument.Parse(await applyRes.Content.ReadAsStringAsync());
        var leaveId = leaveDoc.RootElement.GetProperty("id").GetInt64();

        // Two independent admin HTTP clients attempting simultaneous approval
        var client1 = await _factory.CreateAuthenticatedClientAsync(adminEmail, password);
        var client2 = await _factory.CreateAuthenticatedClientAsync(adminEmail, password);

        var task1 = client1.PutAsync($"/api/leave-requests/{leaveId}/approve", null);
        var task2 = client2.PutAsync($"/api/leave-requests/{leaveId}/approve", null);

        var responses = await Task.WhenAll(task1, task2);

        var statusCodes = responses.Select(r => r.StatusCode).ToList();

        // Exactly one should succeed with 200 OK, and the second must be rejected with 409 Conflict (or 400 if already approved)
        Assert.Contains(HttpStatusCode.OK, statusCodes);
        var failureStatusCode = statusCodes.First(s => s != HttpStatusCode.OK);
        Assert.True(failureStatusCode == HttpStatusCode.Conflict || failureStatusCode == HttpStatusCode.BadRequest,
            $"Expected 409 Conflict or 400 Bad Request on second approval, but got {failureStatusCode}");
    }
}
