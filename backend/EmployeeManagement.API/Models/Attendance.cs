namespace EmployeeManagement.API.Models;

public class Attendance
{
    public long Id { get; set; }
    public long EmployeeId { get; set; }
    public DateOnly AttendanceDate { get; set; }
    public DateTime CheckIn { get; set; }
    public DateTime? CheckOut { get; set; }         // Null until check-out (BR-14)
    public AttendanceStatus Status { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation
    public Employee Employee { get; set; } = null!;
}
