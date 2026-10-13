namespace EmployeeManagement.API.DTOs.Common;

public class CurrentUserContext
{
    public long UserId { get; set; }
    public string Role { get; set; } = string.Empty;
    public long? EmployeeId { get; set; }
}
