using EmployeeManagement.API.DTOs.Leave;
using EmployeeManagement.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EmployeeManagement.API.Controllers;

[ApiController]
[Route("api/leave-types")]
[Route("api/[controller]")]
[Authorize]
public class LeaveTypesController : ControllerBase
{
    private readonly ILeaveTypeService _leaveTypeService;

    public LeaveTypesController(ILeaveTypeService leaveTypeService)
    {
        _leaveTypeService = leaveTypeService;
    }

    /// <summary>
    /// List leave types. Accessible to all authenticated users (Section 8.5).
    /// </summary>
    /// <param name="includeInactive">If true, returns inactive types (Admin view).</param>
    [HttpGet]
    public async Task<IActionResult> GetLeaveTypes([FromQuery] bool includeInactive = false)
    {
        var result = await _leaveTypeService.GetLeaveTypesAsync(includeInactive);
        return Ok(result);
    }

    /// <summary>
    /// Get single leave type by ID.
    /// </summary>
    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetLeaveTypeById(long id)
    {
        var result = await _leaveTypeService.GetLeaveTypeByIdAsync(id);
        return Ok(result);
    }

    /// <summary>
    /// Create a new leave type (FR-LEV-08). Admin only.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> CreateLeaveType([FromBody] CreateLeaveTypeRequestDto request)
    {
        var result = await _leaveTypeService.CreateLeaveTypeAsync(request);
        return CreatedAtAction(nameof(GetLeaveTypeById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Update an existing leave type (FR-LEV-08). Admin only.
    /// </summary>
    [HttpPut("{id:long}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> UpdateLeaveType(long id, [FromBody] UpdateLeaveTypeRequestDto request)
    {
        var result = await _leaveTypeService.UpdateLeaveTypeAsync(id, request);
        return Ok(result);
    }

    /// <summary>
    /// Deactivate a leave type (FR-LEV-08). Admin only.
    /// </summary>
    [HttpDelete("{id:long}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> DeactivateLeaveType(long id)
    {
        var result = await _leaveTypeService.DeactivateLeaveTypeAsync(id);
        return Ok(result);
    }
}
