using System.Security.Claims;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EmployeeManagement.API.Controllers;

[ApiController]
[Route("api/leave-balances")]
[Route("api/[controller]")]
[Authorize]
public class LeaveBalancesController : ControllerBase
{
    private readonly ILeaveBalanceService _leaveBalanceService;

    public LeaveBalancesController(ILeaveBalanceService leaveBalanceService)
    {
        _leaveBalanceService = leaveBalanceService;
    }

    /// <summary>
    /// Retrieve own leave balances for a specified year (FR-LEV-03, Section 8.5).
    /// Defaults to current year if parameter is omitted.
    /// Returns allocated, used, pending, and remaining days for all leave types.
    /// </summary>
    [HttpGet("my")]
    public async Task<IActionResult> GetMyBalances([FromQuery] int? year)
    {
        var userId = GetCurrentUserId();
        var balances = await _leaveBalanceService.GetMyBalancesAsync(userId, year);
        return Ok(balances);
    }

    /// <summary>
    /// Retrieve leave balances for a specific employee and year.
    /// Admin, Manager (team), or self.
    /// </summary>
    [HttpGet("employee/{employeeId:long}")]
    public async Task<IActionResult> GetEmployeeBalances(long employeeId, [FromQuery] int? year)
    {
        var targetYear = year ?? DateTime.UtcNow.Year;
        var balances = await _leaveBalanceService.GetEmployeeBalancesAsync(employeeId, targetYear);
        return Ok(balances);
    }

    /// <summary>
    /// Admin endpoint to generate yearly balances for all active employees for all active leave types (FR-LEV-09, BR-15).
    /// Strictly idempotent and safe to run multiple times without creating duplicates.
    /// Defaults to next year (DateTime.UtcNow.Year + 1) if year is not provided.
    /// </summary>
    [HttpPost("generate")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> GenerateYearlyBalances([FromQuery] int? year)
    {
        var result = await _leaveBalanceService.GenerateYearlyBalancesAsync(year);
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
}
