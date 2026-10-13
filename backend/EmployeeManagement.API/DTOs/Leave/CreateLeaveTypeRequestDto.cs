using System.ComponentModel.DataAnnotations;

namespace EmployeeManagement.API.DTOs.Leave;

public class CreateLeaveTypeRequestDto
{
    [Required(ErrorMessage = "Leave type name is required.")]
    [MaxLength(50, ErrorMessage = "Leave type name cannot exceed 50 characters.")]
    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    [Range(0, 365, ErrorMessage = "Default days must be between 0 and 365.")]
    public decimal DefaultDays { get; set; }

    public bool IsActive { get; set; } = true;
}
