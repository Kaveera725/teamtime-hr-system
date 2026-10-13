using System.ComponentModel.DataAnnotations;

namespace EmployeeManagement.API.DTOs.Employee;

public class CreateEmployeeRequestDto
{
    [Required(ErrorMessage = "User ID is required.")]
    public long UserId { get; set; }

    [Required(ErrorMessage = "Department ID is required.")]
    public long DepartmentId { get; set; }

    public string? EmployeeCode { get; set; }

    [Required(ErrorMessage = "First name is required.")]
    [MaxLength(100, ErrorMessage = "First name cannot exceed 100 characters.")]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Last name is required.")]
    [MaxLength(100, ErrorMessage = "Last name cannot exceed 100 characters.")]
    public string LastName { get; set; } = string.Empty;

    [MaxLength(20, ErrorMessage = "Phone cannot exceed 20 characters.")]
    public string? Phone { get; set; }

    [Required(ErrorMessage = "Position is required.")]
    [MaxLength(100, ErrorMessage = "Position cannot exceed 100 characters.")]
    public string Position { get; set; } = string.Empty;

    public DateOnly? JoinedDate { get; set; }
}
