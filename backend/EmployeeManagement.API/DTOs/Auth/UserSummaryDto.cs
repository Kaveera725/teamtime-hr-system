namespace EmployeeManagement.API.DTOs.Auth;

public class UserSummaryDto
{
    public long Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public long? EmployeeId { get; set; }
    public string? FullName { get; set; }
}
