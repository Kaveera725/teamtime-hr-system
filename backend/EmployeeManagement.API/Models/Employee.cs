namespace EmployeeManagement.API.Models;

public class Employee
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public long DepartmentId { get; set; }
    public string Position { get; set; } = string.Empty;
    public DateOnly JoinedDate { get; set; }
    public EmployeeStatus Status { get; set; } = EmployeeStatus.ACTIVE;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public Department Department { get; set; } = null!;

    // Department where this employee is the manager (circular)
    public Department? ManagedDepartment { get; set; }

    public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();
    public ICollection<LeaveRequest> LeaveRequests { get; set; } = new List<LeaveRequest>();
    public ICollection<LeaveBalance> LeaveBalances { get; set; } = new List<LeaveBalance>();

    // Leave requests this employee approved/rejected as approver
    public ICollection<LeaveRequest> ApprovedLeaveRequests { get; set; } = new List<LeaveRequest>();

    // Computed helper (not stored)
    public string FullName => $"{FirstName} {LastName}";
}
