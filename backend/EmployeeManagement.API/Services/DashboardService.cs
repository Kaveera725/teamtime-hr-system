using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Dashboard;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;

namespace EmployeeManagement.API.Services;

public class DashboardService : IDashboardService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILeaveBalanceService _leaveBalanceService;
    private readonly IAttendanceService _attendanceService;
    private readonly ILogger<DashboardService> _logger;

    public DashboardService(
        ApplicationDbContext dbContext,
        ILeaveBalanceService leaveBalanceService,
        IAttendanceService attendanceService,
        ILogger<DashboardService> logger)
    {
        _dbContext = dbContext;
        _leaveBalanceService = leaveBalanceService;
        _attendanceService = attendanceService;
        _logger = logger;
    }

    /// <summary>
    /// Returns the role-specific dashboard payload based on the user's role (Section 3.6).
    /// </summary>
    public async Task<object> GetDashboardAsync(CurrentUserContext userContext)
    {
        var role = userContext.Role.ToUpperInvariant();
        return role switch
        {
            "ADMIN" => await GetAdminDashboardAsync(userContext),
            "MANAGER" => await GetManagerDashboardAsync(userContext),
            _ => await GetEmployeeDashboardAsync(userContext.UserId)
        };
    }

    /// <summary>
    /// Employee dashboard (FR-DSH-01, Section 3.6):
    /// Leave balances, today's attendance state, last 5 leave requests, and upcoming approved leave.
    /// </summary>
    public async Task<EmployeeDashboardDto> GetEmployeeDashboardAsync(long userId)
    {
        var employee = await _dbContext.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.UserId == userId);

        if (employee == null)
        {
            throw new NotFoundException("Employee profile not found for the current user.");
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var currentYear = today.Year;

        // 1. Leave balances (Allocated, Used, Pending, Remaining, Available)
        var leaveBalances = await _leaveBalanceService.GetEmployeeBalancesAsync(employee.Id, currentYear);

        // 2. Today's attendance state
        var todayAttendance = await _attendanceService.GetMyTodayStateAsync(userId);

        // 3. Last 5 leave requests (projected, AsNoTracking, no N+1)
        var last5LeaveRequests = await _dbContext.LeaveRequests
            .AsNoTracking()
            .Where(lr => lr.EmployeeId == employee.Id)
            .OrderByDescending(lr => lr.CreatedAt)
            .Take(5)
            .Select(lr => new DashboardLeaveRequestItemDto
            {
                Id = lr.Id,
                LeaveTypeId = lr.LeaveTypeId,
                LeaveTypeName = lr.LeaveType.Name,
                StartDate = lr.StartDate,
                EndDate = lr.EndDate,
                TotalDays = lr.TotalDays,
                Status = lr.Status.ToString(),
                Reason = lr.Reason,
                ApprovedByName = lr.ApprovedBy != null ? $"{lr.ApprovedBy.FirstName} {lr.ApprovedBy.LastName}".Trim() : null,
                ApprovedAt = lr.ApprovedAt,
                CreatedAt = lr.CreatedAt
            })
            .ToListAsync();

        // 4. Upcoming approved leave (status APPROVED and EndDate >= today)
        var upcomingApprovedLeave = await _dbContext.LeaveRequests
            .AsNoTracking()
            .Where(lr => lr.EmployeeId == employee.Id
                      && lr.Status == LeaveStatus.APPROVED
                      && lr.EndDate >= today)
            .OrderBy(lr => lr.StartDate)
            .Select(lr => new DashboardLeaveRequestItemDto
            {
                Id = lr.Id,
                LeaveTypeId = lr.LeaveTypeId,
                LeaveTypeName = lr.LeaveType.Name,
                StartDate = lr.StartDate,
                EndDate = lr.EndDate,
                TotalDays = lr.TotalDays,
                Status = lr.Status.ToString(),
                Reason = lr.Reason,
                ApprovedByName = lr.ApprovedBy != null ? $"{lr.ApprovedBy.FirstName} {lr.ApprovedBy.LastName}".Trim() : null,
                ApprovedAt = lr.ApprovedAt,
                CreatedAt = lr.CreatedAt
            })
            .ToListAsync();

        _logger.LogInformation("Generated Employee Dashboard for Employee ID {EmployeeId} ({Name})",
            employee.Id, employee.FullName);

        return new EmployeeDashboardDto
        {
            EmployeeId = employee.Id,
            EmployeeName = employee.FullName,
            DepartmentName = employee.Department?.Name ?? string.Empty,
            LeaveBalances = leaveBalances,
            TodayAttendance = todayAttendance,
            Last5LeaveRequests = last5LeaveRequests,
            UpcomingApprovedLeave = upcomingApprovedLeave
        };
    }

    /// <summary>
    /// Manager dashboard (FR-DSH-02, Section 3.6):
    /// Pending approvals count & list, team status today (present/late/on leave/absent with names),
    /// and team members on leave this week.
    /// </summary>
    public async Task<ManagerDashboardDto> GetManagerDashboardAsync(CurrentUserContext userContext)
    {
        var managerEmp = await _dbContext.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.UserId == userContext.UserId);

        if (managerEmp == null)
        {
            throw new NotFoundException("Manager employee profile not found.");
        }

        // Departments managed by this manager
        var managedDepts = await _dbContext.Departments
            .AsNoTracking()
            .Where(d => d.ManagerId == managerEmp.Id)
            .Select(d => new { d.Id, d.Name })
            .ToListAsync();

        var managedDeptIds = managedDepts.Select(d => d.Id).ToList();
        var primaryDept = managedDepts.FirstOrDefault();

        if (managedDeptIds.Count == 0)
        {
            return new ManagerDashboardDto
            {
                DepartmentId = managerEmp.DepartmentId,
                DepartmentName = managerEmp.Department?.Name,
                PendingApprovalsCount = 0,
                PendingApprovals = new List<DashboardPendingApprovalDto>(),
                TeamStatusToday = new DashboardTeamStatusTodayDto
                {
                    Date = DateOnly.FromDateTime(DateTime.UtcNow)
                },
                TeamMembersOnLeaveThisWeek = new List<DashboardTeamMemberOnLeaveDto>()
            };
        }

        // 1. Pending approvals count and list (excluding manager's own request per BR-07)
        var pendingQuery = _dbContext.LeaveRequests
            .AsNoTracking()
            .Where(lr => lr.Status == LeaveStatus.PENDING
                      && lr.EmployeeId != managerEmp.Id
                      && managedDeptIds.Contains(lr.Employee.DepartmentId));

        var pendingApprovalsCount = await pendingQuery.CountAsync();

        var pendingApprovals = await pendingQuery
            .OrderByDescending(lr => lr.CreatedAt)
            .Select(lr => new DashboardPendingApprovalDto
            {
                Id = lr.Id,
                EmployeeId = lr.EmployeeId,
                EmployeeCode = lr.Employee.EmployeeCode,
                EmployeeName = $"{lr.Employee.FirstName} {lr.Employee.LastName}".Trim(),
                LeaveTypeId = lr.LeaveTypeId,
                LeaveTypeName = lr.LeaveType.Name,
                StartDate = lr.StartDate,
                EndDate = lr.EndDate,
                TotalDays = lr.TotalDays,
                Reason = lr.Reason,
                CreatedAt = lr.CreatedAt
            })
            .ToListAsync();

        // 2. Team status today (present/late/on leave/absent with names)
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Fetch team members in managed departments
        var teamEmployees = await _dbContext.Employees
            .AsNoTracking()
            .Where(e => managedDeptIds.Contains(e.DepartmentId) && e.Status == EmployeeStatus.ACTIVE)
            .OrderBy(e => e.FirstName)
            .ThenBy(e => e.LastName)
            .Select(e => new
            {
                e.Id,
                e.EmployeeCode,
                FullName = $"{e.FirstName} {e.LastName}".Trim()
            })
            .ToListAsync();

        var teamEmpIds = teamEmployees.Select(e => e.Id).ToList();

        // Fetch today's attendance for team
        var attendances = await _dbContext.Attendances
            .AsNoTracking()
            .Where(a => a.AttendanceDate == today && teamEmpIds.Contains(a.EmployeeId))
            .ToDictionaryAsync(a => a.EmployeeId);

        // Fetch today's approved leaves for team
        var leaves = await _dbContext.LeaveRequests
            .AsNoTracking()
            .Include(lr => lr.LeaveType)
            .Where(lr => lr.Status == LeaveStatus.APPROVED
                      && lr.StartDate <= today && lr.EndDate >= today
                      && teamEmpIds.Contains(lr.EmployeeId))
            .ToDictionaryAsync(lr => lr.EmployeeId);

        var presentList = new List<TeamMemberStatusDto>();
        var lateList = new List<TeamMemberStatusDto>();
        var onLeaveList = new List<TeamMemberOnLeaveDto>();
        var absentList = new List<TeamMemberAbsentDto>();

        foreach (var emp in teamEmployees)
        {
            if (attendances.TryGetValue(emp.Id, out var att))
            {
                var item = new TeamMemberStatusDto
                {
                    EmployeeId = emp.Id,
                    EmployeeCode = emp.EmployeeCode,
                    EmployeeName = emp.FullName,
                    Status = att.Status.ToString(),
                    CheckIn = att.CheckIn,
                    CheckOut = att.CheckOut,
                    WorkedHours = att.CheckOut.HasValue ? Math.Round((att.CheckOut.Value - att.CheckIn).TotalHours, 2) : null
                };

                if (att.Status == AttendanceStatus.LATE)
                {
                    lateList.Add(item);
                }
                else
                {
                    presentList.Add(item);
                }
            }
            else if (leaves.TryGetValue(emp.Id, out var leave))
            {
                onLeaveList.Add(new TeamMemberOnLeaveDto
                {
                    EmployeeId = emp.Id,
                    EmployeeCode = emp.EmployeeCode,
                    EmployeeName = emp.FullName,
                    LeaveTypeName = leave.LeaveType?.Name ?? "Leave",
                    StartDate = leave.StartDate,
                    EndDate = leave.EndDate
                });
            }
            else
            {
                absentList.Add(new TeamMemberAbsentDto
                {
                    EmployeeId = emp.Id,
                    EmployeeCode = emp.EmployeeCode,
                    EmployeeName = emp.FullName
                });
            }
        }

        var teamStatusToday = new DashboardTeamStatusTodayDto
        {
            Date = today,
            TotalTeamMembers = teamEmployees.Count,
            PresentCount = presentList.Count,
            LateCount = lateList.Count,
            OnLeaveCount = onLeaveList.Count,
            AbsentCount = absentList.Count,
            Present = presentList,
            Late = lateList,
            OnLeave = onLeaveList,
            Absent = absentList
        };

        // 3. Team members on leave this week (Monday to Sunday of current week)
        int diff = ((int)today.DayOfWeek - (int)DayOfWeek.Monday + 7) % 7;
        var weekStart = today.AddDays(-diff);
        var weekEnd = weekStart.AddDays(6);

        var onLeaveThisWeek = await _dbContext.LeaveRequests
            .AsNoTracking()
            .Where(lr => lr.Status == LeaveStatus.APPROVED
                      && lr.StartDate <= weekEnd && lr.EndDate >= weekStart
                      && teamEmpIds.Contains(lr.EmployeeId))
            .OrderBy(lr => lr.StartDate)
            .Select(lr => new DashboardTeamMemberOnLeaveDto
            {
                EmployeeId = lr.EmployeeId,
                EmployeeCode = lr.Employee.EmployeeCode,
                EmployeeName = $"{lr.Employee.FirstName} {lr.Employee.LastName}".Trim(),
                LeaveTypeName = lr.LeaveType.Name,
                StartDate = lr.StartDate,
                EndDate = lr.EndDate,
                TotalDays = lr.TotalDays
            })
            .ToListAsync();

        _logger.LogInformation("Generated Manager Dashboard for Manager ID {ManagerId}: {PendingCount} pending approvals, {TeamSize} team members",
            managerEmp.Id, pendingApprovalsCount, teamEmployees.Count);

        return new ManagerDashboardDto
        {
            DepartmentId = primaryDept?.Id,
            DepartmentName = primaryDept?.Name,
            PendingApprovalsCount = pendingApprovalsCount,
            PendingApprovals = pendingApprovals,
            TeamStatusToday = teamStatusToday,
            TeamMembersOnLeaveThisWeek = onLeaveThisWeek
        };
    }

    /// <summary>
    /// Admin dashboard (FR-DSH-03, Section 3.6):
    /// Total/active headcount, department breakdown, today's attendance summary,
    /// pending leave count, current month leave days used, and 6-month historical chart trend.
    /// </summary>
    public async Task<AdminDashboardDto> GetAdminDashboardAsync(CurrentUserContext userContext)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // 1. Total and active employee counts
        var totalEmployees = await _dbContext.Employees.CountAsync();
        var activeEmployees = await _dbContext.Employees.CountAsync(e => e.Status == EmployeeStatus.ACTIVE);

        // 2. Employees per department breakdown
        var employeesPerDepartment = await _dbContext.Departments
            .AsNoTracking()
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentHeadcountDto
            {
                DepartmentId = d.Id,
                DepartmentName = d.Name,
                TotalEmployees = d.Employees.Count,
                ActiveEmployees = d.Employees.Count(e => e.Status == EmployeeStatus.ACTIVE)
            })
            .ToListAsync();

        // 3. Today's organization-wide attendance summary
        var todayAttendanceSummary = await _attendanceService.GetTodaySummaryAsync(userContext);

        // 4. Pending leave count across the organization
        var pendingLeaveCount = await _dbContext.LeaveRequests
            .CountAsync(lr => lr.Status == LeaveStatus.PENDING);

        // 5. Leave days used this month and 6-month chart trend (single query for performance)
        var sixMonthsAgoDate = today.AddMonths(-5);
        var firstMonthStart = new DateOnly(sixMonthsAgoDate.Year, sixMonthsAgoDate.Month, 1);
        var currentMonthEnd = new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month));

        var approvedLeaves = await _dbContext.LeaveRequests
            .AsNoTracking()
            .Where(lr => lr.Status == LeaveStatus.APPROVED
                      && lr.StartDate <= currentMonthEnd
                      && lr.EndDate >= firstMonthStart)
            .Select(lr => new { lr.StartDate, lr.EndDate, lr.TotalDays })
            .ToListAsync();

        var monthlyChart = new List<MonthlyLeaveUsageDto>();
        decimal thisMonthDays = 0m;

        for (int i = 5; i >= 0; i--)
        {
            var targetMonth = today.AddMonths(-i);
            var mStart = new DateOnly(targetMonth.Year, targetMonth.Month, 1);
            var mEnd = new DateOnly(targetMonth.Year, targetMonth.Month, DateTime.DaysInMonth(targetMonth.Year, targetMonth.Month));
            var monthLabel = targetMonth.ToString("MMM yyyy");

            decimal monthTotal = 0m;
            foreach (var leave in approvedLeaves)
            {
                if (leave.StartDate <= mEnd && leave.EndDate >= mStart)
                {
                    var overlapStart = leave.StartDate > mStart ? leave.StartDate : mStart;
                    var overlapEnd = leave.EndDate < mEnd ? leave.EndDate : mEnd;

                    if (leave.TotalDays == 0.5m && leave.StartDate == leave.EndDate)
                    {
                        monthTotal += 0.5m;
                    }
                    else
                    {
                        if (LeaveDayCalculator.TryCalculateWorkingDays(overlapStart, overlapEnd, false, out var days, out _))
                        {
                            monthTotal += days;
                        }
                    }
                }
            }

            if (i == 0)
            {
                thisMonthDays = monthTotal;
            }

            monthlyChart.Add(new MonthlyLeaveUsageDto
            {
                Year = targetMonth.Year,
                Month = targetMonth.Month,
                MonthName = monthLabel,
                TotalDays = monthTotal
            });
        }

        _logger.LogInformation("Generated Admin Dashboard: {Total} total employees, {Active} active, {Pending} pending leaves, {MonthDays} days used this month",
            totalEmployees, activeEmployees, pendingLeaveCount, thisMonthDays);

        return new AdminDashboardDto
        {
            TotalEmployees = totalEmployees,
            ActiveEmployees = activeEmployees,
            EmployeesPerDepartment = employeesPerDepartment,
            TodayAttendanceSummary = todayAttendanceSummary,
            PendingLeaveCount = pendingLeaveCount,
            LeaveDaysUsedThisMonth = thisMonthDays,
            LeaveDaysPerMonthLast6Months = monthlyChart
        };
    }
}
