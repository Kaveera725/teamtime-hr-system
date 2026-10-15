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
/// Unit tests specifically for leave request overlap detection (BR-03, FR-LEV-02).
/// Requirement: A request is rejected if it overlaps any PENDING or APPROVED request of the same employee.
/// </summary>
public class LeaveOverlapDetectionTests
{
    private readonly ILogger<LeaveService> _logger;

    public LeaveOverlapDetectionTests()
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

    private static async Task<(User user, Employee emp, LeaveType leaveType)> SeedEmployeeWithLeaveType(ApplicationDbContext context)
    {
        var dept = new Department { Name = "Engineering" };
        context.Departments.Add(dept);

        var user = new User { Email = "john.dev@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            UserId = user.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "EMP099",
            FirstName = "John",
            LastName = "Doe",
            Position = "Developer",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.Add(emp);

        var leaveType = new LeaveType { Name = "Annual Leave", DefaultDays = 20, IsActive = true };
        context.LeaveTypes.Add(leaveType);
        await context.SaveChangesAsync();

        var balanceCurrent = new LeaveBalance
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            Year = DateTime.UtcNow.Year,
            AllocatedDays = 20m,
            UsedDays = 0m
        };
        var balanceNext = new LeaveBalance
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            Year = DateTime.UtcNow.Year + 1,
            AllocatedDays = 20m,
            UsedDays = 0m
        };
        context.LeaveBalances.AddRange(balanceCurrent, balanceNext);
        await context.SaveChangesAsync();

        return (user, emp, leaveType);
    }

    [Theory]
    [InlineData(12, 16, 12, 16)] // Exact same dates (Mon-Fri)
    [InlineData(12, 16, 10, 13)] // Proposed overlaps existing start (Wed to Mon)
    [InlineData(12, 16, 15, 20)] // Proposed overlaps existing end (Thu to Tue)
    [InlineData(12, 16, 13, 15)] // Proposed completely inside existing (Tue to Thu inside Mon-Fri)
    [InlineData(13, 15, 12, 16)] // Proposed completely encloses existing
    public async Task CreateAsync_OverlappingDatesWithPending_ThrowsConflictException(
        int existStartDay, int existEndDay, int newStartDay, int newEndDay)
    {
        using var context = CreateInMemoryDbContext();
        var (user, emp, leaveType) = await SeedEmployeeWithLeaveType(context);
        var service = new LeaveService(context, _logger);

        var year = DateTime.UtcNow.Year + 1; // Future year
        var existingStart = new DateOnly(year, 6, existStartDay);
        var existingEnd = new DateOnly(year, 6, existEndDay);

        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = existingStart,
            EndDate = existingEnd,
            TotalDays = 3m,
            Status = LeaveStatus.PENDING
        });
        await context.SaveChangesAsync();

        var newRequest = new CreateLeaveRequestDto
        {
            LeaveTypeId = leaveType.Id,
            StartDate = new DateOnly(year, 6, newStartDay),
            EndDate = new DateOnly(year, 6, newEndDay),
            Reason = "Testing overlap"
        };

        var ex = await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(user.Id, newRequest));
        Assert.Contains("overlap", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateAsync_OverlappingWithApprovedRequest_ThrowsConflictException()
    {
        using var context = CreateInMemoryDbContext();
        var (user, emp, leaveType) = await SeedEmployeeWithLeaveType(context);
        var service = new LeaveService(context, _logger);

        var year = DateTime.UtcNow.Year + 1;
        var existingStart = new DateOnly(year, 7, 6);
        var existingEnd = new DateOnly(year, 7, 10);

        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = existingStart,
            EndDate = existingEnd,
            TotalDays = 5m,
            Status = LeaveStatus.APPROVED
        });
        await context.SaveChangesAsync();

        var newRequest = new CreateLeaveRequestDto
        {
            LeaveTypeId = leaveType.Id,
            StartDate = new DateOnly(year, 7, 8),
            EndDate = new DateOnly(year, 7, 9),
            Reason = "Overlapping approved"
        };

        var ex = await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(user.Id, newRequest));
        Assert.Contains("overlap", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateAsync_OverlappingWithRejectedRequest_Allowed()
    {
        using var context = CreateInMemoryDbContext();
        var (user, emp, leaveType) = await SeedEmployeeWithLeaveType(context);
        var service = new LeaveService(context, _logger);

        var year = DateTime.UtcNow.Year + 1;
        var date = new DateOnly(year, 8, 10); // Monday

        // Rejected request on same date
        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = date,
            EndDate = date,
            TotalDays = 1m,
            Status = LeaveStatus.REJECTED,
            RejectionReason = "Previously rejected"
        });
        await context.SaveChangesAsync();

        var newRequest = new CreateLeaveRequestDto
        {
            LeaveTypeId = leaveType.Id,
            StartDate = date,
            EndDate = date,
            Reason = "Re-applying after rejection"
        };

        var result = await service.CreateAsync(user.Id, newRequest);
        Assert.Equal("PENDING", result.Status);
    }

    [Fact]
    public async Task CreateAsync_OverlappingWithCancelledRequest_Allowed()
    {
        using var context = CreateInMemoryDbContext();
        var (user, emp, leaveType) = await SeedEmployeeWithLeaveType(context);
        var service = new LeaveService(context, _logger);

        var year = DateTime.UtcNow.Year + 1;
        var date = new DateOnly(year, 8, 17); // Monday

        // Cancelled request on same date
        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = date,
            EndDate = date,
            TotalDays = 1m,
            Status = LeaveStatus.CANCELLED
        });
        await context.SaveChangesAsync();

        var newRequest = new CreateLeaveRequestDto
        {
            LeaveTypeId = leaveType.Id,
            StartDate = date,
            EndDate = date,
            Reason = "Applying after cancellation"
        };

        var result = await service.CreateAsync(user.Id, newRequest);
        Assert.Equal("PENDING", result.Status);
    }

    [Fact]
    public async Task CreateAsync_AdjacentNonOverlappingDates_Allowed()
    {
        using var context = CreateInMemoryDbContext();
        var (user, emp, leaveType) = await SeedEmployeeWithLeaveType(context);
        var service = new LeaveService(context, _logger);

        var year = DateTime.UtcNow.Year + 1;
        // Week 1: Mon-Fri (7 to 11)
        var startWeek1 = new DateOnly(year, 9, 7);
        var endWeek1 = new DateOnly(year, 9, 11);

        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = startWeek1,
            EndDate = endWeek1,
            TotalDays = 5m,
            Status = LeaveStatus.PENDING
        });
        await context.SaveChangesAsync();

        // Week 2: Mon-Fri (14 to 18) - Adjacent but strictly non-overlapping
        var newRequest = new CreateLeaveRequestDto
        {
            LeaveTypeId = leaveType.Id,
            StartDate = new DateOnly(year, 9, 14),
            EndDate = new DateOnly(year, 9, 18),
            Reason = "Following week"
        };

        var result = await service.CreateAsync(user.Id, newRequest);
        Assert.Equal("PENDING", result.Status);
    }
}
