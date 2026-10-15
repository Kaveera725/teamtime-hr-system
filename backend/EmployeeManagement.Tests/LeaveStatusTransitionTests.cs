using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Leave;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Models;
using EmployeeManagement.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Xunit;

namespace EmployeeManagement.Tests;

/// <summary>
/// Unit tests for leave request status transitions per Section 5.1 & Business Rules:
/// PENDING -> APPROVED
/// PENDING -> REJECTED
/// PENDING -> CANCELLED
/// APPROVED -> CANCELLED (before start date only)
/// Terminal states (REJECTED, CANCELLED) cannot transition further.
/// </summary>
public class LeaveStatusTransitionTests
{
    private readonly ILogger<LeaveService> _logger;

    public LeaveStatusTransitionTests()
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

    private static async Task<(Department dept, User adminUser, Employee adminEmp, User empUser, Employee emp, LeaveType leaveType)> SetupEntities(ApplicationDbContext context)
    {
        var dept = new Department { Name = "Operations" };
        context.Departments.Add(dept);

        var adminUser = new User { Email = "admin.ops@company.com", PasswordHash = "hash", Role = UserRole.ADMIN };
        var empUser = new User { Email = "staff.ops@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.AddRange(adminUser, empUser);
        await context.SaveChangesAsync();

        var adminEmp = new Employee
        {
            UserId = adminUser.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "ADM002",
            FirstName = "Admin",
            LastName = "Boss",
            Position = "Director",
            Status = EmployeeStatus.ACTIVE
        };
        var emp = new Employee
        {
            UserId = empUser.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "EMP088",
            FirstName = "Staff",
            LastName = "Worker",
            Position = "Operator",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.AddRange(adminEmp, emp);

        var leaveType = new LeaveType { Name = "Annual Leave", DefaultDays = 14, IsActive = true };
        context.LeaveTypes.Add(leaveType);
        await context.SaveChangesAsync();

        dept.ManagerId = adminEmp.Id;
        var balance = new LeaveBalance
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            Year = DateTime.UtcNow.Year,
            AllocatedDays = 14m,
            UsedDays = 0m
        };
        context.LeaveBalances.Add(balance);
        await context.SaveChangesAsync();

        return (dept, adminUser, adminEmp, empUser, emp, leaveType);
    }

    [Fact]
    public async Task Transition_PendingToApproved_Valid()
    {
        using var context = CreateInMemoryDbContext();
        var (_, adminUser, adminEmp, _, emp, leaveType) = await SetupEntities(context);
        var service = new LeaveService(context, _logger);

        var leave = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8)),
            TotalDays = 2m,
            Status = LeaveStatus.PENDING
        };
        context.LeaveRequests.Add(leave);
        await context.SaveChangesAsync();

        var adminContext = new CurrentUserContext { UserId = adminUser.Id, Role = "ADMIN", EmployeeId = adminEmp.Id };
        var result = await service.ApproveAsync(leave.Id, adminContext);

        Assert.Equal("APPROVED", result.Status);
    }

    [Fact]
    public async Task Transition_PendingToRejected_Valid()
    {
        using var context = CreateInMemoryDbContext();
        var (_, adminUser, adminEmp, _, emp, leaveType) = await SetupEntities(context);
        var service = new LeaveService(context, _logger);

        var leave = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8)),
            TotalDays = 2m,
            Status = LeaveStatus.PENDING
        };
        context.LeaveRequests.Add(leave);
        await context.SaveChangesAsync();

        var adminContext = new CurrentUserContext { UserId = adminUser.Id, Role = "ADMIN", EmployeeId = adminEmp.Id };
        var result = await service.RejectAsync(leave.Id, adminContext, new RejectLeaveRequestDto { RejectionReason = "Staff shortage" });

        Assert.Equal("REJECTED", result.Status);
    }

    [Fact]
    public async Task Transition_PendingToCancelled_Valid()
    {
        using var context = CreateInMemoryDbContext();
        var (_, _, _, empUser, emp, leaveType) = await SetupEntities(context);
        var service = new LeaveService(context, _logger);

        var leave = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8)),
            TotalDays = 2m,
            Status = LeaveStatus.PENDING
        };
        context.LeaveRequests.Add(leave);
        await context.SaveChangesAsync();

        var empContext = new CurrentUserContext { UserId = empUser.Id, Role = "EMPLOYEE", EmployeeId = emp.Id };
        var result = await service.CancelAsync(leave.Id, empContext);

        Assert.Equal("CANCELLED", result.Status);
    }

    [Fact]
    public async Task Transition_ApprovedToCancelled_BeforeStartDate_Valid()
    {
        using var context = CreateInMemoryDbContext();
        var (_, _, _, empUser, emp, leaveType) = await SetupEntities(context);
        var service = new LeaveService(context, _logger);

        var leave = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8)),
            TotalDays = 2m,
            Status = LeaveStatus.APPROVED
        };
        context.LeaveRequests.Add(leave);

        var balance = await context.LeaveBalances.FirstAsync(b => b.EmployeeId == emp.Id && b.LeaveTypeId == leaveType.Id);
        balance.UsedDays = 2m;
        await context.SaveChangesAsync();

        var empContext = new CurrentUserContext { UserId = empUser.Id, Role = "EMPLOYEE", EmployeeId = emp.Id };
        var result = await service.CancelAsync(leave.Id, empContext);

        Assert.Equal("CANCELLED", result.Status);
        var updatedBalance = await context.LeaveBalances.FirstAsync(b => b.EmployeeId == emp.Id && b.LeaveTypeId == leaveType.Id);
        Assert.Equal(0m, updatedBalance.UsedDays); // Restored
    }

    [Fact]
    public async Task Transition_ApprovedToCancelled_AfterStart_ThrowsBusinessRuleException()
    {
        using var context = CreateInMemoryDbContext();
        var (_, _, _, empUser, emp, leaveType) = await SetupEntities(context);
        var service = new LeaveService(context, _logger);

        var leave = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), // Yesterday (already started)
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)),
            TotalDays = 3m,
            Status = LeaveStatus.APPROVED
        };
        context.LeaveRequests.Add(leave);
        await context.SaveChangesAsync();

        var empContext = new CurrentUserContext { UserId = empUser.Id, Role = "EMPLOYEE", EmployeeId = emp.Id };
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.CancelAsync(leave.Id, empContext));
        Assert.Contains("before the start date", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Transition_RejectedToApproved_ThrowsBusinessRuleException()
    {
        using var context = CreateInMemoryDbContext();
        var (_, adminUser, adminEmp, _, emp, leaveType) = await SetupEntities(context);
        var service = new LeaveService(context, _logger);

        var leave = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8)),
            TotalDays = 2m,
            Status = LeaveStatus.REJECTED,
            RejectionReason = "Not permitted"
        };
        context.LeaveRequests.Add(leave);
        await context.SaveChangesAsync();

        var adminContext = new CurrentUserContext { UserId = adminUser.Id, Role = "ADMIN", EmployeeId = adminEmp.Id };
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.ApproveAsync(leave.Id, adminContext));
        Assert.Contains("PENDING", ex.Message);
    }

    [Fact]
    public async Task Transition_CancelledToApproved_ThrowsBusinessRuleException()
    {
        using var context = CreateInMemoryDbContext();
        var (_, adminUser, adminEmp, _, emp, leaveType) = await SetupEntities(context);
        var service = new LeaveService(context, _logger);

        var leave = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8)),
            TotalDays = 2m,
            Status = LeaveStatus.CANCELLED
        };
        context.LeaveRequests.Add(leave);
        await context.SaveChangesAsync();

        var adminContext = new CurrentUserContext { UserId = adminUser.Id, Role = "ADMIN", EmployeeId = adminEmp.Id };
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.ApproveAsync(leave.Id, adminContext));
        Assert.Contains("PENDING", ex.Message);
    }

    [Fact]
    public async Task Transition_ApprovedToRejected_ThrowsBusinessRuleException()
    {
        using var context = CreateInMemoryDbContext();
        var (_, adminUser, adminEmp, _, emp, leaveType) = await SetupEntities(context);
        var service = new LeaveService(context, _logger);

        var leave = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8)),
            TotalDays = 2m,
            Status = LeaveStatus.APPROVED
        };
        context.LeaveRequests.Add(leave);
        await context.SaveChangesAsync();

        var adminContext = new CurrentUserContext { UserId = adminUser.Id, Role = "ADMIN", EmployeeId = adminEmp.Id };
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.RejectAsync(leave.Id, adminContext, new RejectLeaveRequestDto { RejectionReason = "Second thought" }));
        Assert.Contains("PENDING", ex.Message);
    }
}
