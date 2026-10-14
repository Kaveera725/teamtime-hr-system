using EmployeeManagement.API.Models;

namespace EmployeeManagement.API.DTOs.Leave;

public class LeaveRequestQueryParameters
{
    public LeaveStatus? Status { get; set; }
    public long? EmployeeId { get; set; }
    public long? DepartmentId { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}
