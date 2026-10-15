using System.Security.Claims;
using EmployeeManagement.API.DTOs.Attendance;
using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EmployeeManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AttendanceController : ControllerBase
{
    private readonly IAttendanceService _attendanceService;

    public AttendanceController(IAttendanceService attendanceService)
    {
        _attendanceService = attendanceService;
    }

    /// <summary>
    /// Check in for today (FR-ATT-01, Section 8.4, BR-10, BR-11).
    /// Allowed on working days only. One check-in per day (409 Conflict if duplicate).
    /// </summary>
    [HttpPost("check-in")]
    public async Task<IActionResult> CheckIn([FromBody] CheckInRequestDto? request = null)
    {
        var userId = GetCurrentUserId();
        var result = await _attendanceService.CheckInAsync(userId, request, request?.CheckInTime);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Check out for today (FR-ATT-02, Section 8.4, BR-12).
    /// Only allowed after checking in on the same day. Worked duration under 4 hours marks HALF_DAY.
    /// </summary>
    [HttpPost("check-out")]
    public async Task<IActionResult> CheckOut([FromBody] CheckOutRequestDto? request = null)
    {
        var userId = GetCurrentUserId();
        var result = await _attendanceService.CheckOutAsync(userId, request, request?.CheckOutTime);
        return Ok(result);
    }

    /// <summary>
    /// Returns today's attendance state for the current user (NOT_CHECKED_IN, CHECKED_IN, CHECKED_OUT).
    /// Designed for UI to render the appropriate action button without guesswork.
    /// </summary>
    [HttpGet("my/today")]
    public async Task<IActionResult> GetMyTodayState()
    {
        var userId = GetCurrentUserId();
        var result = await _attendanceService.GetMyTodayStateAsync(userId);
        return Ok(result);
    }

    /// <summary>
    /// View own attendance history for a date range (FR-ATT-04, Section 8.4).
    /// </summary>
    [HttpGet("my")]
    public async Task<IActionResult> GetMyAttendanceHistory([FromQuery] DateOnly? from, [FromQuery] DateOnly? to)
    {
        var userId = GetCurrentUserId();
        var result = await _attendanceService.GetMyAttendanceHistoryAsync(userId, from, to);
        return Ok(result);
    }

    /// <summary>
    /// View attendance history for a specific employee (FR-ATT-05, Section 8.4).
    /// Access: Admin sees all; Manager sees own team members; 403 otherwise.
    /// </summary>
    [HttpGet("employee/{employeeId:long}")]
    public async Task<IActionResult> GetEmployeeAttendanceHistory(
        long employeeId,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to)
    {
        var result = await _attendanceService.GetEmployeeAttendanceHistoryAsync(
            employeeId, from, to, GetCurrentUserContext());
        return Ok(result);
    }

    /// <summary>
    /// Today's attendance summary (FR-ATT-06, Section 8.4).
    /// Counts and lists of present, late, onLeave, and absent employees.
    /// Scoped to manager's team; Admin sees the entire organization.
    /// </summary>
    [HttpGet("today")]
    [Authorize(Roles = "ADMIN,MANAGER")]
    public async Task<IActionResult> GetTodaySummary([FromQuery] DateOnly? date)
    {
        var result = await _attendanceService.GetTodaySummaryAsync(GetCurrentUserContext(), date);
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
