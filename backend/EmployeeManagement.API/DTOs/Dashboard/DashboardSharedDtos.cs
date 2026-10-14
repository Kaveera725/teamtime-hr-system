namespace EmployeeManagement.API.DTOs.Dashboard;

public class DashboardLeaveRequestItemDto
{
    public long Id { get; set; }
    public long LeaveTypeId { get; set; }
    public string LeaveTypeName { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal TotalDays { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class DashboardPendingApprovalDto
{
    public long Id { get; set; }
    public long EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string EmployeeName { get; set; } = string.Empty;
    public long LeaveTypeId { get; set; }
    public string LeaveTypeName { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal TotalDays { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class DashboardTeamStatusTodayDto
{
    public DateOnly Date { get; set; }
    public int TotalTeamMembers { get; set; }
    public int PresentCount { get; set; }
    public int LateCount { get; set; }
    public int OnLeaveCount { get; set; }
    public int AbsentCount { get; set; }

    public List<TeamMemberStatusDto> Present { get; set; } = new();
    public List<TeamMemberStatusDto> Late { get; set; } = new();
    public List<TeamMemberOnLeaveDto> OnLeave { get; set; } = new();
    public List<TeamMemberAbsentDto> Absent { get; set; } = new();
}

public class TeamMemberStatusDto
{
    public long EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string EmployeeName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CheckIn { get; set; }
    public DateTime? CheckOut { get; set; }
    public double? WorkedHours { get; set; }
}

public class TeamMemberOnLeaveDto
{
    public long EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string EmployeeName { get; set; } = string.Empty;
    public string LeaveTypeName { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
}

public class TeamMemberAbsentDto
{
    public long EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string EmployeeName { get; set; } = string.Empty;
}

public class DashboardTeamMemberOnLeaveDto
{
    public long EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string EmployeeName { get; set; } = string.Empty;
    public string LeaveTypeName { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal TotalDays { get; set; }
}

public class DepartmentHeadcountDto
{
    public long DepartmentId { get; set; }
    public string DepartmentName { get; set; } = string.Empty;
    public int TotalEmployees { get; set; }
    public int ActiveEmployees { get; set; }
}

public class MonthlyLeaveUsageDto
{
    public int Year { get; set; }
    public int Month { get; set; }
    public string MonthName { get; set; } = string.Empty;
    public decimal TotalDays { get; set; }
}
