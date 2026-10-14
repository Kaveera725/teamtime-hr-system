using EmployeeManagement.API.DTOs.Attendance;
using EmployeeManagement.API.DTOs.Leave;

namespace EmployeeManagement.API.DTOs.Dashboard;

/// <summary>
/// Dashboard payload for employees (FR-DSH-01, Section 3.6).
/// Contains leave balances, today's attendance state, last 5 requests, and upcoming approved leave.
/// </summary>
public class EmployeeDashboardDto
{
    public long EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;

    public IReadOnlyList<LeaveBalanceDto> LeaveBalances { get; set; } = Array.Empty<LeaveBalanceDto>();
    public TodayAttendanceStateDto TodayAttendance { get; set; } = new();
    public List<DashboardLeaveRequestItemDto> Last5LeaveRequests { get; set; } = new();
    public List<DashboardLeaveRequestItemDto> UpcomingApprovedLeave { get; set; } = new();
}
