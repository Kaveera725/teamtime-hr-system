using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Leave;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Models;
using EmployeeManagement.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Xunit;

namespace EmployeeManagement.Tests;

/// <summary>
/// Unit tests for leave balance verification including pending days deduction (BR-04, FR-LEV-02).
/// Requirement: Requested days must not exceed remaining days minus days in pending requests for that type and year.
/// No Pay Leave is exempt.
/// </summary>
public class LeaveBalanceCheckTests
{
    private readonly ILogger<LeaveService> _logger;

    public LeaveBalanceCheckTests()
    {
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        _logger = loggerFactory.CreateLogger<LeaveService>();
    }

    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private static async Task<(User user, Employee emp, LeaveType annualLeave, LeaveType noPayLeave)> SeedEmployeeWithBalances(
        ApplicationDbContext context, decimal allocatedDays, decimal usedDays)
    {
        var dept = new Department { Name = "Finance" };
        context.Departments.Add(dept);

        var user = new User { Email = "sarah.finance@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            UserId = user.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "EMP050",
            FirstName = "Sarah",
            LastName = "Connor",
            Position = "Accountant",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.Add(emp);

        var annualLeave = new LeaveType { Name = "Annual Leave", DefaultDays = allocatedDays, IsActive = true };
        var noPayLeave = new LeaveType { Name = "No Pay Leave", DefaultDays = 0, IsActive = true };
        context.LeaveTypes.AddRange(annualLeave, noPayLeave);
        await context.SaveChangesAsync();

        var currentYear = DateTime.UtcNow.Year;
        var balance = new LeaveBalance
        {
            EmployeeId = emp.Id,
            LeaveTypeId = annualLeave.Id,
            Year = currentYear,
            AllocatedDays = allocatedDays,
            UsedDays = usedDays
        };
        context.LeaveBalances.Add(balance);
        await context.SaveChangesAsync();

        return (user, emp, annualLeave, noPayLeave);
    }

    [Fact]
    public async Task CreateAsync_WhenPendingDaysExhaustAvailableBalance_ThrowsBusinessRuleException()
    {
        // Total allocated = 14, Used = 0.
        // Existing pending request = 10 days.
        // Available for new request = 14 - 10 = 4 days.
        // Submitting request for 5 days should fail per BR-04!
        using var context = CreateInMemoryDbContext();
        var (user, emp, annualLeave, _) = await SeedEmployeeWithBalances(context, allocatedDays: 14m, usedDays: 0m);
        var service = new LeaveService(context, _logger);

        var year = DateTime.UtcNow.Year;
        var pendingStart = new DateOnly(year, 11, 2); // Mon
        var pendingEnd = new DateOnly(year, 11, 13);  // Fri (2 weeks = 10 working days)

        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = annualLeave.Id,
            StartDate = pendingStart,
            EndDate = pendingEnd,
            TotalDays = 10m,
            Status = LeaveStatus.PENDING
        });
        await context.SaveChangesAsync();

        // New request for 5 days: Mon Nov 16 to Fri Nov 20
        var newRequest = new CreateLeaveRequestDto
        {
            LeaveTypeId = annualLeave.Id,
            StartDate = new DateOnly(year, 11, 16),
            EndDate = new DateOnly(year, 11, 20),
            Reason = "Vacation"
        };

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.CreateAsync(user.Id, newRequest));
        Assert.Contains("Insufficient leave balance", ex.Message);
        Assert.Contains("4", ex.Message); // mentions 4 days remaining or available
    }

    [Fact]
    public async Task CreateAsync_WhenPendingDaysLeaveSufficientBalance_Succeeds()
    {
        // Total allocated = 14, Used = 0.
        // Existing pending = 10 days.
        // Available = 4 days.
        // Requesting 4 days should succeed!
        using var context = CreateInMemoryDbContext();
        var (user, emp, annualLeave, _) = await SeedEmployeeWithBalances(context, allocatedDays: 14m, usedDays: 0m);
        var service = new LeaveService(context, _logger);

        var year = DateTime.UtcNow.Year;
        var pendingStart = new DateOnly(year, 11, 2);
        var pendingEnd = new DateOnly(year, 11, 13); // 10 days

        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = annualLeave.Id,
            StartDate = pendingStart,
            EndDate = pendingEnd,
            TotalDays = 10m,
            Status = LeaveStatus.PENDING
        });
        await context.SaveChangesAsync();

        // 4 days: Mon Nov 16 to Thu Nov 19
        var newRequest = new CreateLeaveRequestDto
        {
            LeaveTypeId = annualLeave.Id,
            StartDate = new DateOnly(year, 11, 16),
            EndDate = new DateOnly(year, 11, 19),
            Reason = "Short trip"
        };

        var result = await service.CreateAsync(user.Id, newRequest);
        Assert.Equal("PENDING", result.Status);
        Assert.Equal(4.0m, result.TotalDays);
    }

    [Fact]
    public async Task CreateAsync_WithBothUsedAndPendingDays_CalculatesAvailableCorrectly()
    {
        // Allocated = 14, Used = 4. Remaining = 10.
        // Pending = 5.
        // Effective Available = 14 - 4 - 5 = 5 days.
        // Requesting 6 days should fail; requesting 5 days should succeed!
        using var context = CreateInMemoryDbContext();
        var (user, emp, annualLeave, _) = await SeedEmployeeWithBalances(context, allocatedDays: 14m, usedDays: 4m);
        var service = new LeaveService(context, _logger);

        var year = DateTime.UtcNow.Year;
        var pendingStart = new DateOnly(year, 11, 2);
        var pendingEnd = new DateOnly(year, 11, 6); // 5 days

        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = annualLeave.Id,
            StartDate = pendingStart,
            EndDate = pendingEnd,
            TotalDays = 5m,
            Status = LeaveStatus.PENDING
        });
        await context.SaveChangesAsync();

        // Request 6 days (Mon Nov 16 to Mon Nov 23) -> fails
        var failRequest = new CreateLeaveRequestDto
        {
            LeaveTypeId = annualLeave.Id,
            StartDate = new DateOnly(year, 11, 16),
            EndDate = new DateOnly(year, 11, 23),
            Reason = "Too long"
        };

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.CreateAsync(user.Id, failRequest));
        Assert.Contains("Insufficient leave balance", ex.Message);

        // Request 5 days (Mon Nov 16 to Fri Nov 20) -> succeeds
        var passRequest = new CreateLeaveRequestDto
        {
            LeaveTypeId = annualLeave.Id,
            StartDate = new DateOnly(year, 11, 16),
            EndDate = new DateOnly(year, 11, 20),
            Reason = "Exact fit"
        };

        var result = await service.CreateAsync(user.Id, passRequest);
        Assert.Equal("PENDING", result.Status);
        Assert.Equal(5m, result.TotalDays);
    }

    [Fact]
    public async Task CreateAsync_NoPayLeave_IgnoresAllocationsAndPendingDays()
    {
        // No Pay Leave is exempt from balance check (BR-04)
        using var context = CreateInMemoryDbContext();
        var (user, _, _, noPayLeave) = await SeedEmployeeWithBalances(context, allocatedDays: 14m, usedDays: 0m);
        var service = new LeaveService(context, _logger);

        var year = DateTime.UtcNow.Year;
        var request = new CreateLeaveRequestDto
        {
            LeaveTypeId = noPayLeave.Id,
            StartDate = new DateOnly(year, 11, 2),
            EndDate = new DateOnly(year, 11, 20), // 15 working days
            Reason = "Extended sabbatical"
        };

        var result = await service.CreateAsync(user.Id, request);
        Assert.Equal("PENDING", result.Status);
        Assert.Equal(15m, result.TotalDays);
    }
}
