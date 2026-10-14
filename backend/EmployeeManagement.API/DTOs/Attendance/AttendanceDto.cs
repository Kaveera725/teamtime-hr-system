namespace EmployeeManagement.API.DTOs.Attendance;

public class AttendanceDto
{
    public long Id { get; set; }
    public long EmployeeId { get; set; }
    public string EmployeeName { get; set; } = string.Empty;
    public string EmployeeCode { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public DateOnly AttendanceDate { get; set; }
    public DateTime? CheckIn { get; set; }
    public DateTime? CheckOut { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public double? WorkedHours { get; set; }
    public bool HasMissingCheckOut { get; set; }
}
