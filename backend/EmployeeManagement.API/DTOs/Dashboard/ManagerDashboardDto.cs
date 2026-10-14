namespace EmployeeManagement.API.DTOs.Dashboard;

/// <summary>
/// Dashboard payload for managers (FR-DSH-02, Section 3.6).
/// Contains pending approvals count & list, team status today with names, and team members on leave this week.
/// </summary>
public class ManagerDashboardDto
{
    public long? DepartmentId { get; set; }
    public string? DepartmentName { get; set; }

    public int PendingApprovalsCount { get; set; }
    public List<DashboardPendingApprovalDto> PendingApprovals { get; set; } = new();

    public DashboardTeamStatusTodayDto TeamStatusToday { get; set; } = new();

    public List<DashboardTeamMemberOnLeaveDto> TeamMembersOnLeaveThisWeek { get; set; } = new();
}
