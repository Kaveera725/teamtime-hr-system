using System.ComponentModel.DataAnnotations;

namespace EmployeeManagement.API.DTOs.Leave;

public class LeaveRequestPreviewRequestDto
{
    [Required(ErrorMessage = "Leave type ID is required.")]
    public long LeaveTypeId { get; set; }

    [Required(ErrorMessage = "Start date is required.")]
    public DateOnly StartDate { get; set; }

    [Required(ErrorMessage = "End date is required.")]
    public DateOnly EndDate { get; set; }

    public bool IsHalfDay { get; set; } = false;
}
