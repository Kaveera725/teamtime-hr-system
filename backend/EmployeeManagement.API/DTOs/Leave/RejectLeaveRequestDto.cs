using System.ComponentModel.DataAnnotations;

namespace EmployeeManagement.API.DTOs.Leave;

public class RejectLeaveRequestDto
{
    [Required(ErrorMessage = "Rejection reason is required.")]
    [MinLength(1, ErrorMessage = "Rejection reason cannot be empty.")]
    [MaxLength(500, ErrorMessage = "Rejection reason cannot exceed 500 characters.")]
    public string RejectionReason { get; set; } = string.Empty;
}
