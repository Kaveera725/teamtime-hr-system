using System.Security.Claims;
using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Leave;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using EmployeeManagement.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EmployeeManagement.API.Controllers;

[ApiController]
[Route("api/leave-requests")]
[Authorize]
public class LeaveRequestsController : ControllerBase
{
    private readonly ILeaveService _leaveService;

    public LeaveRequestsController(ILeaveService leaveService)
    {
        _leaveService = leaveService;
    }

    /// <summary>
    /// 
    /// Submits a new leave request (FR-LEV-01, Section 8.5).
    /// Follows validation sequence 5.2 (BR-01 through BR-09).
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(LeaveRequestDto), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(HttpValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create([FromBody] CreateLeaveRequestDto request)
    {
        var userId = GetCurrentUserId();
        var result = await _leaveService.CreateAsync(userId, request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Returns live calculation preview (working days, balance after request, rule violations) without saving.
    /// Used by frontend forms for immediate user feedback before submission.
    /// </summary>
    [HttpPost("preview")]
    [ProducesResponseType(typeof(LeaveRequestPreviewResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> Preview([FromBody] LeaveRequestPreviewRequestDto request)
    {
        var userId = GetCurrentUserId();
        var result = await _leaveService.PreviewAsync(userId, request);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves current user's leave requests with optional filters and pagination (FR-LEV-03, Section 8.5).
    /// </summary>
    [HttpGet("my")]
    [ProducesResponseType(typeof(PagedResult<LeaveRequestDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyRequests(
        [FromQuery] LeaveStatus? status,
        [FromQuery] int? year,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = GetCurrentUserId();
        var result = await _leaveService.GetMyRequestsAsync(userId, status, year, page, pageSize);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves company or team leave requests (Section 8.5).
    /// Manager is scoped to their department team; Admin can view all.
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "ADMIN,MANAGER")]
    [ProducesResponseType(typeof(PagedResult<LeaveRequestDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAll([FromQuery] LeaveRequestQueryParameters query)
    {
        var userContext = GetCurrentUserContext();
        var result = await _leaveService.GetRequestsAsync(userContext, query);
        return Ok(result);
    }

    /// <summary>
    /// Retrieves a single leave request by ID (Section 8.5).
    /// Accessible to request owner, team manager, or administrator.
    /// </summary>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(LeaveRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById([FromRoute] long id)
    {
        var userContext = GetCurrentUserContext();
        var result = await _leaveService.GetByIdAsync(id, userContext);
        return Ok(result);
    }

    /// <summary>
    /// Approves a pending leave request and deducts leave balance atomically (BR-05, BR-07, Section 5.1).
    /// Uses PostgreSQL xmin concurrency token to prevent double approvals (returns 409 Conflict).
    /// </summary>
    [HttpPut("{id:long}/approve")]
    [Authorize(Roles = "ADMIN,MANAGER")]
    [ProducesResponseType(typeof(LeaveRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Approve([FromRoute] long id)
    {
        var userContext = GetCurrentUserContext();
        var result = await _leaveService.ApproveAsync(id, userContext);
        return Ok(result);
    }

    /// <summary>
    /// Rejects a pending leave request with a mandatory reason (BR-07, Section 5.1).
    /// </summary>
    [HttpPut("{id:long}/reject")]
    [Authorize(Roles = "ADMIN,MANAGER")]
    [ProducesResponseType(typeof(LeaveRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Reject([FromRoute] long id, [FromBody] RejectLeaveRequestDto dto)
    {
        var userContext = GetCurrentUserContext();
        var result = await _leaveService.RejectAsync(id, userContext, dto);
        return Ok(result);
    }

    /// <summary>
    /// Cancels a leave request (FR-LEV-04, BR-06, Section 5.1).
    /// Owner can cancel PENDING, or APPROVED before start date (restoring used days).
    /// </summary>
    [HttpPut("{id:long}/cancel")]
    [ProducesResponseType(typeof(LeaveRequestDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Cancel([FromRoute] long id)
    {
        var userContext = GetCurrentUserContext();
        var result = await _leaveService.CancelAsync(id, userContext);
        return Ok(result);
    }

    private long GetCurrentUserId()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("userId")?.Value;

        if (string.IsNullOrEmpty(userIdStr) || !long.TryParse(userIdStr, out var userId))
        {
            throw new ForbiddenException("Invalid authentication credentials.");
        }

        return userId;
    }

    private CurrentUserContext GetCurrentUserContext()
    {
        var userId = GetCurrentUserId();
        var role = User.FindFirst(ClaimTypes.Role)?.Value
            ?? User.FindFirst("role")?.Value ?? string.Empty;

        var employeeIdStr = User.FindFirst("employeeId")?.Value;
        long? employeeId = long.TryParse(employeeIdStr, out var empId) ? empId : null;

        return new CurrentUserContext
        {
            UserId = userId,
            Role = role,
            EmployeeId = employeeId
        };
    }
}
