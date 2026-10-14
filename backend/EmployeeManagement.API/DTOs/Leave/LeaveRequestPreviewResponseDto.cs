namespace EmployeeManagement.API.DTOs.Leave;

public class LeaveRequestPreviewResponseDto
{
    public decimal WorkingDays { get; set; }
    public decimal AllocatedDays { get; set; }
    public decimal UsedDays { get; set; }
    public decimal PendingDays { get; set; }
    public decimal AvailableBalance { get; set; }
    public decimal BalanceAfter { get; set; }
    public bool IsValid { get; set; }
    public List<string> ValidationErrors { get; set; } = new();
}
