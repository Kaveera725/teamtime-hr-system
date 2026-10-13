namespace EmployeeManagement.API.DTOs.Leave;

public class LeaveBalanceDto
{
    public long Id { get; set; }
    public long LeaveTypeId { get; set; }
    public string LeaveTypeName { get; set; } = string.Empty;
    public int Year { get; set; }
    public decimal AllocatedDays { get; set; }
    public decimal UsedDays { get; set; }
    public decimal PendingDays { get; set; }
    public decimal RemainingDays => AllocatedDays - UsedDays;
    public decimal AvailableDays => RemainingDays - PendingDays;
}
