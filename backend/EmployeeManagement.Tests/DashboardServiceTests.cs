using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Dashboard;
using EmployeeManagement.API.Models;
using EmployeeManagement.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Xunit;

namespace EmployeeManagement.Tests;

public class DashboardServiceTests
{
    private readonly ILogger<DashboardService> _logger;
    private readonly ILogger<AttendanceService> _attendanceLogger;
    private readonly ILogger<LeaveBalanceService> _balanceLogger;
    private readonly IConfiguration _configuration;

    public DashboardServiceTests()
    {
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        _logger = loggerFactory.CreateLogger<DashboardService>();
        _attendanceLogger = loggerFactory.CreateLogger<AttendanceService>();
        _balanceLogger = loggerFactory.CreateLogger<LeaveBalanceService>();

        var settings = new Dictionary<string, string?>
        {
            { "Attendance:LateAfter", "09:00" }
        };
        _configuration = new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
    }

    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    private async Task<(Department itDept, User managerUser, Employee managerEmp, User empUser, Employee emp)> SeedBaseData(ApplicationDbContext context)
    {
        var itDept = new Department { Name = "IT" };
        context.Departments.Add(itDept);
        await context.SaveChangesAsync();

        var managerUser = new User { Email = "manager@company.com", PasswordHash = "hash", Role = UserRole.MANAGER };
        var empUser = new User { Email = "dev@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.AddRange(managerUser, empUser);
        await context.SaveChangesAsync();

        var managerEmp = new Employee
        {
            UserId = managerUser.Id,
            DepartmentId = itDept.Id,
            EmployeeCode = "MGR001",
            FirstName = "Alice",
            LastName = "Manager",
            Position = "Engineering Lead",
            Status = EmployeeStatus.ACTIVE
        };

        var emp = new Employee
        {
            UserId = empUser.Id,
            DepartmentId = itDept.Id,
            EmployeeCode = "EMP001",
            FirstName = "Bob",
            LastName = "Developer",
            Position = "Software Engineer",
            Status = EmployeeStatus.ACTIVE
        };

        context.Employees.AddRange(managerEmp, emp);
        await context.SaveChangesAsync();

        itDept.ManagerId = managerEmp.Id;
        await context.SaveChangesAsync();

        var annualLeave = new LeaveType { Name = "Annual Leave", DefaultDays = 14, IsActive = true };
        context.LeaveTypes.Add(annualLeave);
        await context.SaveChangesAsync();

        var currentYear = DateTime.UtcNow.Year;
        context.LeaveBalances.Add(new LeaveBalance
        {
            EmployeeId = emp.Id,
            LeaveTypeId = annualLeave.Id,
            Year = currentYear,
            AllocatedDays = 14m,
            UsedDays = 2m
        });
        await context.SaveChangesAsync();

        return (itDept, managerUser, managerEmp, empUser, emp);
    }

    [Fact]
    public async Task GetEmployeeDashboard_Returns_Balances_Attendance_Last5_And_UpcomingLeave()
    {
        using var context = CreateInMemoryDbContext();
        var (_, _, _, empUser, emp) = await SeedBaseData(context);

        var leaveType = await context.LeaveTypes.FirstAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Add 6 leave requests for employee (to verify Take(5))
        for (int i = 1; i <= 6; i++)
        {
            context.LeaveRequests.Add(new LeaveRequest
            {
                EmployeeId = emp.Id,
                LeaveTypeId = leaveType.Id,
                StartDate = today.AddDays(i * 5),
                EndDate = today.AddDays(i * 5 + 1),
                TotalDays = 2m,
                Status = i == 1 ? LeaveStatus.APPROVED : LeaveStatus.PENDING,
                CreatedAt = DateTime.UtcNow.AddMinutes(i)
            });
        }
        await context.SaveChangesAsync();

        var attendanceService = new AttendanceService(context, _configuration, _attendanceLogger);
        var balanceService = new LeaveBalanceService(context, _balanceLogger);
        var dashboardService = new DashboardService(context, balanceService, attendanceService, _logger);

        var result = await dashboardService.GetEmployeeDashboardAsync(empUser.Id);

        Assert.Equal(emp.Id, result.EmployeeId);
        Assert.Equal("Bob Developer", result.EmployeeName);
        Assert.Equal("IT", result.DepartmentName);

        // Balances
        Assert.NotEmpty(result.LeaveBalances);
        Assert.Equal(14m, result.LeaveBalances[0].AllocatedDays);

        // Attendance state
        Assert.Equal("NOT_CHECKED_IN", result.TodayAttendance.State);

        // Last 5 leave requests
        Assert.Equal(5, result.Last5LeaveRequests.Count);

        // Upcoming approved leave
        Assert.Single(result.UpcomingApprovedLeave);
        Assert.Equal("APPROVED", result.UpcomingApprovedLeave[0].Status);
    }

    [Fact]
    public async Task GetManagerDashboard_Returns_PendingApprovals_TeamStatus_And_LeaveThisWeek()
    {
        using var context = CreateInMemoryDbContext();
        var (_, managerUser, managerEmp, _, emp) = await SeedBaseData(context);
        var leaveType = await context.LeaveTypes.FirstAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Team member pending leave
        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = today.AddDays(7),
            EndDate = today.AddDays(8),
            TotalDays = 2m,
            Status = LeaveStatus.PENDING,
            Reason = "Vacation"
        });

        // Manager's own pending leave (should NOT be in manager's approval list per BR-07)
        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = managerEmp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = today.AddDays(14),
            EndDate = today.AddDays(15),
            TotalDays = 2m,
            Status = LeaveStatus.PENDING,
            Reason = "Manager Vacation"
        });

        // Team member check-in today (LATE)
        context.Attendances.Add(new Attendance
        {
            EmployeeId = emp.Id,
            AttendanceDate = today,
            CheckIn = DateTime.UtcNow.Date.AddHours(9).AddMinutes(15),
            Status = AttendanceStatus.LATE
        });

        await context.SaveChangesAsync();

        var attendanceService = new AttendanceService(context, _configuration, _attendanceLogger);
        var balanceService = new LeaveBalanceService(context, _balanceLogger);
        var dashboardService = new DashboardService(context, balanceService, attendanceService, _logger);

        var managerContext = new CurrentUserContext
        {
            UserId = managerUser.Id,
            Role = "MANAGER",
            EmployeeId = managerEmp.Id
        };

        var result = await dashboardService.GetManagerDashboardAsync(managerContext);

        Assert.Equal("IT", result.DepartmentName);
        // Only 1 pending approval (excludes manager's own request)
        Assert.Equal(1, result.PendingApprovalsCount);
        Assert.Single(result.PendingApprovals);
        Assert.Equal("Bob Developer", result.PendingApprovals[0].EmployeeName);

        // Team status today
        Assert.Equal(2, result.TeamStatusToday.TotalTeamMembers);
        Assert.Equal(1, result.TeamStatusToday.LateCount);
        Assert.Single(result.TeamStatusToday.Late);
        Assert.Equal("Bob Developer", result.TeamStatusToday.Late[0].EmployeeName);

        // Manager had no check-in today -> Absent
        Assert.Equal(1, result.TeamStatusToday.AbsentCount);
        Assert.Single(result.TeamStatusToday.Absent);
        Assert.Equal("Alice Manager", result.TeamStatusToday.Absent[0].EmployeeName);
    }

    [Fact]
    public async Task GetAdminDashboard_Returns_Headcount_Breakdown_AttendanceSummary_And_6MonthChart()
    {
        using var context = CreateInMemoryDbContext();
        var (itDept, _, _, _, emp) = await SeedBaseData(context);

        // Add a second department
        var hrDept = new Department { Name = "HR" };
        context.Departments.Add(hrDept);
        await context.SaveChangesAsync();

        var adminUser = new User { Email = "admin@company.com", PasswordHash = "hash", Role = UserRole.ADMIN };
        context.Users.Add(adminUser);
        await context.SaveChangesAsync();

        var leaveType = await context.LeaveTypes.FirstAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Approved leave in current month (2 days)
        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = today,
            EndDate = today.AddDays(1),
            TotalDays = 2m,
            Status = LeaveStatus.APPROVED
        });

        // Pending leave
        context.LeaveRequests.Add(new LeaveRequest
        {
            EmployeeId = emp.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = today.AddDays(10),
            EndDate = today.AddDays(11),
            TotalDays = 2m,
            Status = LeaveStatus.PENDING
        });

        await context.SaveChangesAsync();

        var attendanceService = new AttendanceService(context, _configuration, _attendanceLogger);
        var balanceService = new LeaveBalanceService(context, _balanceLogger);
        var dashboardService = new DashboardService(context, balanceService, attendanceService, _logger);

        var adminContext = new CurrentUserContext { UserId = adminUser.Id, Role = "ADMIN" };
        var result = await dashboardService.GetAdminDashboardAsync(adminContext);

        Assert.Equal(2, result.TotalEmployees);
        Assert.Equal(2, result.ActiveEmployees);
        Assert.Equal(2, result.EmployeesPerDepartment.Count);

        Assert.Equal(1, result.PendingLeaveCount);
        Assert.Equal(6, result.LeaveDaysPerMonthLast6Months.Count);
        Assert.NotNull(result.TodayAttendanceSummary);
    }

    [Fact]
    public async Task GetDashboardAsync_Dispatches_Correct_Shape_By_Role()
    {
        using var context = CreateInMemoryDbContext();
        var (_, managerUser, managerEmp, empUser, emp) = await SeedBaseData(context);

        var adminUser = new User { Email = "admin@company.com", PasswordHash = "hash", Role = UserRole.ADMIN };
        context.Users.Add(adminUser);
        await context.SaveChangesAsync();

        var attendanceService = new AttendanceService(context, _configuration, _attendanceLogger);
        var balanceService = new LeaveBalanceService(context, _balanceLogger);
        var dashboardService = new DashboardService(context, balanceService, attendanceService, _logger);

        // Employee
        var empRes = await dashboardService.GetDashboardAsync(new CurrentUserContext { UserId = empUser.Id, Role = "EMPLOYEE", EmployeeId = emp.Id });
        Assert.IsType<EmployeeDashboardDto>(empRes);

        // Manager
        var mgrRes = await dashboardService.GetDashboardAsync(new CurrentUserContext { UserId = managerUser.Id, Role = "MANAGER", EmployeeId = managerEmp.Id });
        Assert.IsType<ManagerDashboardDto>(mgrRes);

        // Admin
        var admRes = await dashboardService.GetDashboardAsync(new CurrentUserContext { UserId = adminUser.Id, Role = "ADMIN" });
        Assert.IsType<AdminDashboardDto>(admRes);
    }
}
