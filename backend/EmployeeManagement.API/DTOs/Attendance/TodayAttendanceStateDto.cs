namespace EmployeeManagement.API.DTOs.Attendance;

public class TodayAttendanceStateDto
{
    public string State { get; set; } = "NOT_CHECKED_IN"; // NOT_CHECKED_IN, CHECKED_IN, CHECKED_OUT
    public DateOnly Date { get; set; }
    public bool IsWorkingDay { get; set; }
    public bool CanCheckIn { get; set; }
    public bool CanCheckOut { get; set; }
    public AttendanceDto? Attendance { get; set; }
}
