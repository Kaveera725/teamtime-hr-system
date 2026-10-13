using System.ComponentModel.DataAnnotations;
using EmployeeManagement.API.Models;

namespace EmployeeManagement.API.DTOs.User;

public class CreateUserRequestDto
{
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Invalid email format.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [MinLength(8, ErrorMessage = "Password must be at least 8 characters long.")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "Role is required.")]
    public UserRole Role { get; set; } = UserRole.EMPLOYEE;

    [Required(ErrorMessage = "First name is required.")]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Last name is required.")]
    public string LastName { get; set; } = string.Empty;

    public string? EmployeeCode { get; set; }

    [Required(ErrorMessage = "Department is required.")]
    public long DepartmentId { get; set; }

    [Required(ErrorMessage = "Position is required.")]
    public string Position { get; set; } = string.Empty;

    public string? Phone { get; set; }
}
