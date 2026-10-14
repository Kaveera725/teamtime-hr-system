namespace EmployeeManagement.API.DTOs.Attendance;

public class AttendanceSummaryDto
{
    public DateOnly Date { get; set; }
    public int TotalEmployees { get; set; }
    public int PresentCount { get; set; }
    public int LateCount { get; set; }
    public int HalfDayCount { get; set; }
    public int OnLeaveCount { get; set; }
    public int AbsentCount { get; set; }

    public List<AttendanceItemDto> PresentEmployees { get; set; } = new();
    public List<AttendanceItemDto> LateEmployees { get; set; } = new();
    public List<OnLeaveItemDto> OnLeaveEmployees { get; set; } = new();
    public List<AbsentItemDto> AbsentEmployees { get; set; } = new();
}

public class AttendanceItemDto
{
    public long EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public DateTime CheckIn { get; set; }
    public DateTime? CheckOut { get; set; }
    public string Status { get; set; } = string.Empty;
    public double? WorkedHours { get; set; }
}

public class OnLeaveItemDto
{
    public long EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public string LeaveType { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
}

public class AbsentItemDto
{
    public long EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
}
