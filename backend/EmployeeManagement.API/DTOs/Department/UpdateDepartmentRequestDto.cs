using System.ComponentModel.DataAnnotations;

namespace EmployeeManagement.API.DTOs.Department;

public class UpdateDepartmentRequestDto
{
    [Required(ErrorMessage = "Department name is required.")]
    [MaxLength(100, ErrorMessage = "Department name cannot exceed 100 characters.")]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public long? ManagerId { get; set; }
}
