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

public class LeaveServiceTests
{
    private readonly ILogger<LeaveService> _logger;

    public LeaveServiceTests()
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

    private static async Task<(Department dept, User user, Employee emp, LeaveType annualLeave, LeaveType medicalLeave, LeaveType noPayLeave)> SeedCommonData(ApplicationDbContext context)
    {
        var dept = new Department { Name = "Engineering" };
        context.Departments.Add(dept);

        var user = new User { Email = "dev@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            UserId = user.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "EMP001",
            FirstName = "Alice",
            LastName = "Smith",
            Position = "Engineer",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.Add(emp);

        var annualLeave = new LeaveType { Name = "Annual Leave", DefaultDays = 14, IsActive = true };
        var medicalLeave = new LeaveType { Name = "Medical Leave", DefaultDays = 14, IsActive = true };
        var noPayLeave = new LeaveType { Name = "No Pay Leave", DefaultDays = 0, IsActive = true };
        context.LeaveTypes.AddRange(annualLeave, medicalLeave, noPayLeave);
        await context.SaveChangesAsync();

        var currentYear = DateTime.UtcNow.Year;
        var balance = new LeaveBalance
        {
            EmployeeId = emp.Id,
            LeaveTypeId = annualLeave.Id,
            Year = currentYear,
            AllocatedDays = 14m,
            UsedDays = 0m
        };
        var medicalBalance = new LeaveBalance
        {
            EmployeeId = emp.Id,
            LeaveTypeId = medicalLeave.Id,
            Year = currentYear,
            AllocatedDays = 14m,
            UsedDays = 0m
        };
        context.LeaveBalances.AddRange(balance, medicalBalance);
        await context.SaveChangesAsync();

        return (dept, user, emp, annualLeave, medicalLeave, noPayLeave);
    }

    [Fact]
    public async Task CreateAsync_ValidRequest_CreatesPendingRequest()
    {
        using var context = CreateInMemoryDbContext();
        var (_, user, _, annualLeave, _, _) = await SeedCommonData(context);
        var service = new LeaveService(context, _logger);

        // Next week Mon to Tue
        var nextMonday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));
        while (nextMonday.DayOfWeek != DayOfWeek.Monday) nextMonday = nextMonday.AddDays(1);
        var nextTuesday = nextMonday.AddDays(1);

        var request = new CreateLeaveRequestDto
        {
            LeaveTypeId = annualLeave.Id,
            StartDate = nextMonday,
            EndDate = nextTuesday,
            IsHalfDay = false,
            Reason = "Vacation"
        };

        var result = await service.CreateAsync(user.Id, request);

        Assert.Equal("PENDING", result.Status);
        Assert.Equal(2.0m, result.TotalDays);
        Assert.Equal("Alice Smith", result.EmployeeName);
        Assert.Equal("Annual Leave", result.LeaveTypeName);
    }

    [Fact]
    public async Task CreateAsync_OverlappingRequest_ThrowsConflictException()
    {
        using var context = CreateInMemoryDbContext();
        var (_, user, emp, annualLeave, _, _) = await SeedCommonData(context);
        var service = new LeaveService(context, _logger);

        var nextMonday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));
        while (nextMonday.DayOfWeek != DayOfWeek.Monday) nextMonday = nextMonday.AddDays(1);
        var nextFriday = nextMonday.AddDays(4);

        // Pre-existing pending request (Mon to Fri)
        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = annualLeave.Id,
            StartDate = nextMonday,
            EndDate = nextFriday,
            TotalDays = 5m,
            Status = LeaveStatus.PENDING
        });
        await context.SaveChangesAsync();

        // New request overlapping Wed to Thu (BR-03)
        var request = new CreateLeaveRequestDto
        {
            LeaveTypeId = annualLeave.Id,
            StartDate = nextMonday.AddDays(2),
            EndDate = nextMonday.AddDays(3),
            Reason = "Overlap test"
        };

        var ex = await Assert.ThrowsAsync<ConflictException>(() => service.CreateAsync(user.Id, request));
        Assert.Contains("overlap", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateAsync_InsufficientBalance_ThrowsBusinessRuleException()
    {
        using var context = CreateInMemoryDbContext();
        var (_, user, _, annualLeave, _, _) = await SeedCommonData(context);
        var service = new LeaveService(context, _logger);

        // Next month Mon to 3 weeks later (15 working days > 14 allocated)
        var nextMonday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(14));
        while (nextMonday.DayOfWeek != DayOfWeek.Monday) nextMonday = nextMonday.AddDays(1);
        var threeWeeksLater = nextMonday.AddDays(18); // 3 work weeks = 15 days

        var request = new CreateLeaveRequestDto
        {
            LeaveTypeId = annualLeave.Id,
            StartDate = nextMonday,
            EndDate = threeWeeksLater,
            Reason = "Too many days"
        };

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.CreateAsync(user.Id, request));
        Assert.Contains("Insufficient leave balance", ex.Message);
    }

    [Fact]
    public async Task CreateAsync_NoPayLeave_IsExemptFromBalanceCheck()
    {
        using var context = CreateInMemoryDbContext();
        var (_, user, _, _, _, noPayLeave) = await SeedCommonData(context);
        var service = new LeaveService(context, _logger);

        var nextMonday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));
        while (nextMonday.DayOfWeek != DayOfWeek.Monday) nextMonday = nextMonday.AddDays(1);

        var request = new CreateLeaveRequestDto
        {
            LeaveTypeId = noPayLeave.Id,
            StartDate = nextMonday,
            EndDate = nextMonday.AddDays(4), // 5 days
            Reason = "No pay personal time"
        };

        var result = await service.CreateAsync(user.Id, request);
        Assert.Equal("PENDING", result.Status);
        Assert.Equal(5.0m, result.TotalDays);
    }

    [Fact]
    public async Task CreateAsync_YearBoundaryViolation_ThrowsBusinessRuleException()
    {
        using var context = CreateInMemoryDbContext();
        var (_, user, _, annualLeave, _, _) = await SeedCommonData(context);
        var service = new LeaveService(context, _logger);

        var request = new CreateLeaveRequestDto
        {
            LeaveTypeId = annualLeave.Id,
            StartDate = new DateOnly(2026, 12, 30),
            EndDate = new DateOnly(2027, 1, 4), // Spanning 2 calendar years (BR-08)
            Reason = "New year"
        };

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.CreateAsync(user.Id, request));
        Assert.Contains("cannot span two calendar years", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateAsync_PastDateRule_AnnualLeaveInPast_ThrowsBusinessRuleException()
    {
        using var context = CreateInMemoryDbContext();
        var (_, user, _, annualLeave, _, _) = await SeedCommonData(context);
        var service = new LeaveService(context, _logger);

        var pastDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2));

        var request = new CreateLeaveRequestDto
        {
            LeaveTypeId = annualLeave.Id,
            StartDate = pastDate,
            EndDate = pastDate,
            Reason = "Past date"
        };

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.CreateAsync(user.Id, request));
        Assert.Contains("today or in the future", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task CreateAsync_PastDateRule_MedicalLeaveUpTo3Days_Allowed()
    {
        using var context = CreateInMemoryDbContext();
        var (_, user, _, _, medicalLeave, _) = await SeedCommonData(context);
        var service = new LeaveService(context, _logger);

        // 2 days ago (BR-09 allows up to 3 days backdate)
        var twoDaysAgo = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2));
        while (twoDaysAgo.DayOfWeek == DayOfWeek.Saturday || twoDaysAgo.DayOfWeek == DayOfWeek.Sunday)
        {
            twoDaysAgo = twoDaysAgo.AddDays(-1);
        }

        // Ensure balance exists for that year
        var balance = await context.LeaveBalances.FirstOrDefaultAsync(b => b.LeaveTypeId == medicalLeave.Id && b.Year == twoDaysAgo.Year);
        if (balance == null)
        {
            context.LeaveBalances.Add(new LeaveBalance
            {
                EmployeeId = 1,
                LeaveTypeId = medicalLeave.Id,
                Year = twoDaysAgo.Year,
                AllocatedDays = 14m
            });
            await context.SaveChangesAsync();
        }

        var request = new CreateLeaveRequestDto
        {
            LeaveTypeId = medicalLeave.Id,
            StartDate = twoDaysAgo,
            EndDate = twoDaysAgo,
            Reason = "Was sick"
        };

        var result = await service.CreateAsync(user.Id, request);
        Assert.Equal("PENDING", result.Status);
    }

    [Fact]
    public async Task CreateAsync_PastDateRule_MedicalLeaveMoreThan3Days_ThrowsBusinessRuleException()
    {
        using var context = CreateInMemoryDbContext();
        var (_, user, _, _, medicalLeave, _) = await SeedCommonData(context);
        var service = new LeaveService(context, _logger);

        var fourDaysAgo = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-4));

        var request = new CreateLeaveRequestDto
        {
            LeaveTypeId = medicalLeave.Id,
            StartDate = fourDaysAgo,
            EndDate = fourDaysAgo,
            Reason = "Very late sick note"
        };

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.CreateAsync(user.Id, request));
        Assert.Contains("cannot be backdated more than 3 days", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApproveAsync_TeamManager_ApprovesAndDeductsBalanceAtomically()
    {
        using var context = CreateInMemoryDbContext();
        var (dept, user, emp, annualLeave, _, _) = await SeedCommonData(context);

        // Create manager
        var managerUser = new User { Email = "manager@company.com", PasswordHash = "hash", Role = UserRole.MANAGER };
        context.Users.Add(managerUser);
        await context.SaveChangesAsync();

        var managerEmp = new Employee
        {
            UserId = managerUser.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "MGR001",
            FirstName = "Bob",
            LastName = "Manager",
            Position = "Lead",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.Add(managerEmp);
        await context.SaveChangesAsync();

        // Assign manager to department
        dept.ManagerId = managerEmp.Id;
        await context.SaveChangesAsync();

        var nextMonday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));
        while (nextMonday.DayOfWeek != DayOfWeek.Monday) nextMonday = nextMonday.AddDays(1);

        var leaveRequest = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = annualLeave.Id,
            StartDate = nextMonday,
            EndDate = nextMonday.AddDays(1), // 2 days
            TotalDays = 2m,
            Status = LeaveStatus.PENDING
        };
        context.LeaveRequests.Add(leaveRequest);
        await context.SaveChangesAsync();

        var service = new LeaveService(context, _logger);
        var managerContext = new CurrentUserContext
        {
            UserId = managerUser.Id,
            Role = "MANAGER",
            EmployeeId = managerEmp.Id
        };

        var result = await service.ApproveAsync(leaveRequest.Id, managerContext);

        Assert.Equal("APPROVED", result.Status);
        Assert.Equal("Bob Manager", result.ApprovedByName);
        Assert.NotNull(result.ApprovedAt);

        // Check that balance was deducted (BR-05)
        var balance = await context.LeaveBalances.FirstAsync(b => b.EmployeeId == emp.Id && b.LeaveTypeId == annualLeave.Id);
        Assert.Equal(2.0m, balance.UsedDays);
    }

    [Fact]
    public async Task ApproveAsync_SelfApproval_ThrowsForbiddenException()
    {
        using var context = CreateInMemoryDbContext();
        var (_, user, emp, annualLeave, _, _) = await SeedCommonData(context);

        var leaveRequest = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = annualLeave.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8)),
            TotalDays = 2m,
            Status = LeaveStatus.PENDING
        };
        context.LeaveRequests.Add(leaveRequest);
        await context.SaveChangesAsync();

        var service = new LeaveService(context, _logger);
        var selfContext = new CurrentUserContext
        {
            UserId = user.Id,
            Role = "ADMIN", // Even an admin cannot approve own request (BR-07)
            EmployeeId = emp.Id
        };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() => service.ApproveAsync(leaveRequest.Id, selfContext));
        Assert.Contains("cannot approve your own leave request", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ApproveAsync_ManagerOwnRequest_CanOnlyBeApprovedByAdmin()
    {
        using var context = CreateInMemoryDbContext();
        var (dept, _, _, annualLeave, _, _) = await SeedCommonData(context);

        // Create manager
        var managerUser = new User { Email = "manager@company.com", PasswordHash = "hash", Role = UserRole.MANAGER };
        context.Users.Add(managerUser);
        await context.SaveChangesAsync();

        var managerEmp = new Employee
        {
            UserId = managerUser.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "MGR001",
            FirstName = "Bob",
            LastName = "Manager",
            Position = "Lead",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.Add(managerEmp);
        dept.ManagerId = managerEmp.Id;
        await context.SaveChangesAsync();

        // Create another manager (peer)
        var peerUser = new User { Email = "peer@company.com", PasswordHash = "hash", Role = UserRole.MANAGER };
        context.Users.Add(peerUser);
        await context.SaveChangesAsync();

        var peerEmp = new Employee
        {
            UserId = peerUser.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "MGR002",
            FirstName = "Charlie",
            LastName = "Lead",
            Position = "Lead",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.Add(peerEmp);
        await context.SaveChangesAsync();

        var leaveRequest = new LeaveRequest
        {
            EmployeeId = managerEmp.Id,
            LeaveTypeId = annualLeave.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8)),
            TotalDays = 2m,
            Status = LeaveStatus.PENDING
        };
        context.LeaveRequests.Add(leaveRequest);
        await context.SaveChangesAsync();

        var service = new LeaveService(context, _logger);
        var peerContext = new CurrentUserContext
        {
            UserId = peerUser.Id,
            Role = "MANAGER",
            EmployeeId = peerEmp.Id
        };

        // Peer manager cannot approve manager's request (BR-07)
        var ex = await Assert.ThrowsAsync<ForbiddenException>(() => service.ApproveAsync(leaveRequest.Id, peerContext));
        Assert.Contains("must be approved by an administrator", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RejectAsync_RequiresReason_UpdatesStatusToRejected()
    {
        using var context = CreateInMemoryDbContext();
        var (dept, _, emp, annualLeave, _, _) = await SeedCommonData(context);

        var adminUser = new User { Email = "admin@company.com", PasswordHash = "hash", Role = UserRole.ADMIN };
        context.Users.Add(adminUser);
        await context.SaveChangesAsync();

        var adminEmp = new Employee
        {
            UserId = adminUser.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "ADM001",
            FirstName = "Super",
            LastName = "Admin",
            Position = "Admin",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.Add(adminEmp);
        await context.SaveChangesAsync();

        var leaveRequest = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = annualLeave.Id,
            StartDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
            EndDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(8)),
            TotalDays = 2m,
            Status = LeaveStatus.PENDING
        };
        context.LeaveRequests.Add(leaveRequest);
        await context.SaveChangesAsync();

        var service = new LeaveService(context, _logger);
        var adminContext = new CurrentUserContext { UserId = adminUser.Id, Role = "ADMIN", EmployeeId = adminEmp.Id };

        // Empty reason rejected
        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.RejectAsync(leaveRequest.Id, adminContext, new RejectLeaveRequestDto { RejectionReason = "  " }));

        // Valid reason succeeds
        var result = await service.RejectAsync(leaveRequest.Id, adminContext, new RejectLeaveRequestDto { RejectionReason = "Coverage shortage" });
        Assert.Equal("REJECTED", result.Status);
        Assert.Equal("Coverage shortage", result.RejectionReason);
    }

    [Fact]
    public async Task CancelAsync_ApprovedBeforeStartDate_CancelsAndRestoresBalance()
    {
        using var context = CreateInMemoryDbContext();
        var (_, user, emp, annualLeave, _, _) = await SeedCommonData(context);

        var nextWeek = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));
        var leaveRequest = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = annualLeave.Id,
            StartDate = nextWeek,
            EndDate = nextWeek.AddDays(1),
            TotalDays = 2m,
            Status = LeaveStatus.APPROVED
        };
        context.LeaveRequests.Add(leaveRequest);

        // Pre-deduct used days
        var balance = await context.LeaveBalances.FirstAsync(b => b.EmployeeId == emp.Id && b.LeaveTypeId == annualLeave.Id);
        balance.UsedDays = 2m;
        await context.SaveChangesAsync();

        var service = new LeaveService(context, _logger);
        var userContext = new CurrentUserContext { UserId = user.Id, Role = "EMPLOYEE", EmployeeId = emp.Id };

        var result = await service.CancelAsync(leaveRequest.Id, userContext);

        Assert.Equal("CANCELLED", result.Status);
        // Balance restored per BR-06
        var updatedBalance = await context.LeaveBalances.FirstAsync(b => b.EmployeeId == emp.Id && b.LeaveTypeId == annualLeave.Id);
        Assert.Equal(0m, updatedBalance.UsedDays);
    }

    [Fact]
    public async Task CancelAsync_ApprovedOnOrAfterStartDate_ThrowsBusinessRuleException()
    {
        using var context = CreateInMemoryDbContext();
        var (_, user, emp, annualLeave, _, _) = await SeedCommonData(context);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var leaveRequest = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = annualLeave.Id,
            StartDate = today, // Cannot cancel once start date is reached
            EndDate = today.AddDays(2),
            TotalDays = 3m,
            Status = LeaveStatus.APPROVED
        };
        context.LeaveRequests.Add(leaveRequest);
        await context.SaveChangesAsync();

        var service = new LeaveService(context, _logger);
        var userContext = new CurrentUserContext { UserId = user.Id, Role = "EMPLOYEE", EmployeeId = emp.Id };

        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() => service.CancelAsync(leaveRequest.Id, userContext));
        Assert.Contains("before the start date", ex.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task PreviewAsync_ReturnsCalculatedDaysAndValidationStatusWithoutSaving()
    {
        using var context = CreateInMemoryDbContext();
        var (_, user, _, annualLeave, _, _) = await SeedCommonData(context);
        var service = new LeaveService(context, _logger);

        var nextMonday = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7));
        while (nextMonday.DayOfWeek != DayOfWeek.Monday) nextMonday = nextMonday.AddDays(1);

        var previewRequest = new LeaveRequestPreviewRequestDto
        {
            LeaveTypeId = annualLeave.Id,
            StartDate = nextMonday,
            EndDate = nextMonday.AddDays(2), // 3 working days
            IsHalfDay = false
        };

        var result = await service.PreviewAsync(user.Id, previewRequest);

        Assert.True(result.IsValid);
        Assert.Empty(result.ValidationErrors);
        Assert.Equal(3.0m, result.WorkingDays);
        Assert.Equal(14.0m, result.AllocatedDays);
        Assert.Equal(11.0m, result.BalanceAfter);

        // Ensure database was NOT touched
        Assert.Empty(await context.LeaveRequests.ToListAsync());
    }
}
