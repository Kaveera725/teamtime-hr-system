using EmployeeManagement.API.Data;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Models;
using EmployeeManagement.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Xunit;

namespace EmployeeManagement.Tests;

public class LeaveBalanceServiceTests
{
    private readonly ILogger<LeaveBalanceService> _logger;

    public LeaveBalanceServiceTests()
    {
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        _logger = loggerFactory.CreateLogger<LeaveBalanceService>();
    }

    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task CreateBalancesForEmployee_Creates_Active_Types_And_Safe_To_Run_Twice()
    {
        using var context = CreateInMemoryDbContext();
        var dept = new Department { Name = "IT" };
        context.Departments.Add(dept);

        var user = new User { Email = "test@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            UserId = user.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "EMP001",
            FirstName = "Test",
            LastName = "Employee",
            Position = "Dev",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.Add(emp);

        context.LeaveTypes.AddRange(
            new LeaveType { Name = "Annual Leave", DefaultDays = 14, IsActive = true },
            new LeaveType { Name = "Casual Leave", DefaultDays = 7, IsActive = true },
            new LeaveType { Name = "Old Leave", DefaultDays = 5, IsActive = false }
        );
        await context.SaveChangesAsync();

        var service = new LeaveBalanceService(context, _logger);
        int currentYear = DateTime.UtcNow.Year;

        // Run once
        var balances1 = await service.CreateBalancesForEmployeeAsync(emp.Id, currentYear);
        Assert.Equal(2, balances1.Count);
        Assert.All(balances1, b => Assert.Equal(0, b.UsedDays));

        // Run twice - must not duplicate (BR-15)
        var balances2 = await service.CreateBalancesForEmployeeAsync(emp.Id, currentYear);
        Assert.Equal(2, balances2.Count);
        var inDbCount = await context.LeaveBalances.CountAsync(lb => lb.EmployeeId == emp.Id && lb.Year == currentYear);
        Assert.Equal(2, inDbCount);
    }

    [Fact]
    public async Task GetMyBalances_Calculates_Allocated_Used_Pending_Remaining()
    {
        using var context = CreateInMemoryDbContext();
        var dept = new Department { Name = "IT" };
        context.Departments.Add(dept);

        var user = new User { Email = "user@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            UserId = user.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "EMP002",
            FirstName = "Alice",
            LastName = "Smith",
            Position = "Dev",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.Add(emp);

        var ltAnnual = new LeaveType { Name = "Annual Leave", DefaultDays = 14, IsActive = true };
        context.LeaveTypes.Add(ltAnnual);
        await context.SaveChangesAsync();

        int year = 2026;
        var balance = new LeaveBalance
        {
            EmployeeId = emp.Id,
            LeaveTypeId = ltAnnual.Id,
            Year = year,
            AllocatedDays = 14,
            UsedDays = 3, // 3 days already used
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.LeaveBalances.Add(balance);

        // Add pending leave request of 2 days
        var pendingReq = new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = ltAnnual.Id,
            StartDate = new DateOnly(2026, 5, 1),
            EndDate = new DateOnly(2026, 5, 2),
            TotalDays = 2,
            Status = LeaveStatus.PENDING,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.LeaveRequests.Add(pendingReq);
        await context.SaveChangesAsync();

        var service = new LeaveBalanceService(context, _logger);
        var myBalances = await service.GetMyBalancesAsync(user.Id, year);

        Assert.Single(myBalances);
        var annualBalance = myBalances[0];

        Assert.Equal("Annual Leave", annualBalance.LeaveTypeName);
        Assert.Equal(14, annualBalance.AllocatedDays);
        Assert.Equal(3, annualBalance.UsedDays);
        Assert.Equal(2, annualBalance.PendingDays);
        Assert.Equal(11, annualBalance.RemainingDays); // 14 - 3 = 11
        Assert.Equal(9, annualBalance.AvailableDays);  // 11 - 2 = 9
    }

    [Fact]
    public async Task GenerateYearlyBalances_Generates_For_All_Active_Employees_Safe_To_Run_Twice()
    {
        using var context = CreateInMemoryDbContext();
        var dept = new Department { Name = "IT" };
        context.Departments.Add(dept);

        var u1 = new User { Email = "u1@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        var u2 = new User { Email = "u2@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        var u3 = new User { Email = "u3@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.AddRange(u1, u2, u3);
        await context.SaveChangesAsync();

        var activeEmp1 = new Employee { UserId = u1.Id, DepartmentId = dept.Id, EmployeeCode = "EMP001", FirstName = "Act1", LastName = "One", Position = "Dev", Status = EmployeeStatus.ACTIVE };
        var activeEmp2 = new Employee { UserId = u2.Id, DepartmentId = dept.Id, EmployeeCode = "EMP002", FirstName = "Act2", LastName = "Two", Position = "Dev", Status = EmployeeStatus.ACTIVE };
        var inactiveEmp = new Employee { UserId = u3.Id, DepartmentId = dept.Id, EmployeeCode = "EMP003", FirstName = "Inact", LastName = "Three", Position = "Dev", Status = EmployeeStatus.INACTIVE };
        context.Employees.AddRange(activeEmp1, activeEmp2, inactiveEmp);

        context.LeaveTypes.AddRange(
            new LeaveType { Name = "Annual Leave", DefaultDays = 14, IsActive = true },
            new LeaveType { Name = "Medical Leave", DefaultDays = 14, IsActive = true },
            new LeaveType { Name = "Deprecated Leave", DefaultDays = 5, IsActive = false }
        );
        await context.SaveChangesAsync();

        var service = new LeaveBalanceService(context, _logger);
        int nextYear = 2027;

        // Run 1: 2 active employees * 2 active leave types = 4 balances
        var result1 = await service.GenerateYearlyBalancesAsync(nextYear);
        Assert.Equal(nextYear, result1.Year);
        Assert.Equal(2, result1.ActiveEmployeesCount);
        Assert.Equal(2, result1.ActiveLeaveTypesCount);
        Assert.Equal(4, result1.BalancesCreatedCount);
        Assert.Equal(0, result1.BalancesSkippedCount);

        // Run 2: safe to run twice, should skip all 4 without creating duplicates (BR-15)
        var result2 = await service.GenerateYearlyBalancesAsync(nextYear);
        Assert.Equal(0, result2.BalancesCreatedCount);
        Assert.Equal(4, result2.BalancesSkippedCount);

        var totalBalancesInDb = await context.LeaveBalances.CountAsync(lb => lb.Year == nextYear);
        Assert.Equal(4, totalBalancesInDb);
    }

    [Fact]
    public async Task DeductLeaveBalance_And_RestoreLeaveBalance_Workflow()
    {
        using var context = CreateInMemoryDbContext();
        var dept = new Department { Name = "HR" };
        context.Departments.Add(dept);

        var user = new User { Email = "hr@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var emp = new Employee { UserId = user.Id, DepartmentId = dept.Id, EmployeeCode = "EMP010", FirstName = "HR", LastName = "User", Position = "HR", Status = EmployeeStatus.ACTIVE };
        context.Employees.Add(emp);

        var lt = new LeaveType { Name = "Casual Leave", DefaultDays = 7, IsActive = true };
        context.LeaveTypes.Add(lt);
        await context.SaveChangesAsync();

        int year = 2026;
        var balance = new LeaveBalance
        {
            EmployeeId = emp.Id,
            LeaveTypeId = lt.Id,
            Year = year,
            AllocatedDays = 7,
            UsedDays = 2,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.LeaveBalances.Add(balance);
        await context.SaveChangesAsync();

        var service = new LeaveBalanceService(context, _logger);

        // 1. Deduct 3 days -> UsedDays should become 5
        await service.DeductLeaveBalanceAsync(emp.Id, lt.Id, year, 3);
        var bAfterDeduct = await context.LeaveBalances.FindAsync(balance.Id);
        Assert.NotNull(bAfterDeduct);
        Assert.Equal(5, bAfterDeduct.UsedDays);
        Assert.Equal(2, bAfterDeduct.RemainingDays);

        // 2. Deducting more than remaining (e.g. 5 days when only 2 remain) throws BusinessRuleException
        await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.DeductLeaveBalanceAsync(emp.Id, lt.Id, year, 5));

        // 3. Restore 2 days -> UsedDays should decrease from 5 to 3
        await service.RestoreLeaveBalanceAsync(emp.Id, lt.Id, year, 2);
        var bAfterRestore = await context.LeaveBalances.FindAsync(balance.Id);
        Assert.NotNull(bAfterRestore);
        Assert.Equal(3, bAfterRestore.UsedDays);
        Assert.Equal(4, bAfterRestore.RemainingDays);
    }
}
