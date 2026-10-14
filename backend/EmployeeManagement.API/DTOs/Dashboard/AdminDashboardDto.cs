using EmployeeManagement.API.DTOs.Attendance;

namespace EmployeeManagement.API.DTOs.Dashboard;

/// <summary>
/// Dashboard payload for administrators (FR-DSH-03, Section 3.6).
/// Contains headcount, department breakdown, organization attendance summary, pending leave count,
/// current month leave days used, and a 6-month historical chart trend.
/// </summary>
public class AdminDashboardDto
{
    public int TotalEmployees { get; set; }
    public int ActiveEmployees { get; set; }
    public List<DepartmentHeadcountDto> EmployeesPerDepartment { get; set; } = new();

    public AttendanceSummaryDto TodayAttendanceSummary { get; set; } = new();

    public int PendingLeaveCount { get; set; }
    public decimal LeaveDaysUsedThisMonth { get; set; }
    public List<MonthlyLeaveUsageDto> LeaveDaysPerMonthLast6Months { get; set; } = new();
}
