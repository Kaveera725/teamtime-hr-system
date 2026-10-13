namespace EmployeeManagement.API.DTOs.Auth;

public class CurrentUserProfileDto
{
    public long UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public long EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string DepartmentName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
}
