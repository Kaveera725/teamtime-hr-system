namespace EmployeeManagement.API.DTOs.Attendance;

public class CheckInRequestDto
{
    public string? Notes { get; set; }
    public DateTime? CheckInTime { get; set; }
}

public class CheckOutRequestDto
{
    public string? Notes { get; set; }
    public DateTime? CheckOutTime { get; set; }
}

