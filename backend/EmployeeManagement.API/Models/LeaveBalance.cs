namespace EmployeeManagement.API.Models;

public class LeaveBalance
{
    public long Id { get; set; }
    public long EmployeeId { get; set; }
    public long LeaveTypeId { get; set; }
    public int Year { get; set; }
    public decimal AllocatedDays { get; set; }
    public decimal UsedDays { get; set; } = 0;      // Increased on approval (BR-05), restored on cancel (BR-06)
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Computed: NOT stored (Section 7.8 note: remaining_days removed)
    public decimal RemainingDays => AllocatedDays - UsedDays;

    // Navigation
    public Employee Employee { get; set; } = null!;
    public LeaveType LeaveType { get; set; } = null!;
}
