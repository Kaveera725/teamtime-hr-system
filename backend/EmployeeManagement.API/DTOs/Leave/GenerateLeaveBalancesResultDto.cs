namespace EmployeeManagement.API.DTOs.Leave;

public class GenerateLeaveBalancesResultDto
{
    public int Year { get; set; }
    public int ActiveEmployeesCount { get; set; }
    public int ActiveLeaveTypesCount { get; set; }
    public int BalancesCreatedCount { get; set; }
    public int BalancesSkippedCount { get; set; }
    public string Message { get; set; } = string.Empty;
}
