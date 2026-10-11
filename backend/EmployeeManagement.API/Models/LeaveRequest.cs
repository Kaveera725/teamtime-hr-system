namespace EmployeeManagement.API.Models;

public class LeaveRequest
{
    public long Id { get; set; }
    public long EmployeeId { get; set; }
    public long LeaveTypeId { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public decimal TotalDays { get; set; }          // Working days per BR-01, BR-02
    public string? Reason { get; set; }
    public LeaveStatus Status { get; set; } = LeaveStatus.PENDING;
    public long? ApprovedById { get; set; }         // FK to employees (decision maker)
    public DateTime? ApprovedAt { get; set; }
    public string? RejectionReason { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Concurrency token - maps PostgreSQL xmin system column (NFR-03, Section 7.7)
    public uint Version { get; set; }

    // Navigation
    public Employee Employee { get; set; } = null!;
    public LeaveType LeaveType { get; set; } = null!;
    public Employee? ApprovedBy { get; set; }
}
