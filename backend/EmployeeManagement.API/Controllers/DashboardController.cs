using System.Security.Claims;
using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Dashboard;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EmployeeManagement.API.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    /// <summary>
    /// Retrieves role-specific dashboard metrics and operational summaries (Section 3.6).
    /// - Employee: leave balances, today's attendance state, last 5 requests, upcoming approved leave (FR-DSH-01).
    /// - Manager: pending approvals count & list, team status today with names, team members on leave this week (FR-DSH-02).
    /// - Admin: headcount, department breakdown, organization attendance summary, pending leaves, leave days used this month, and 6-month chart trend (FR-DSH-03).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(EmployeeDashboardDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ManagerDashboardDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(AdminDashboardDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetDashboard()
    {
        var userContext = GetCurrentUserContext();
        var dashboard = await _dashboardService.GetDashboardAsync(userContext);
        return Ok(dashboard);
    }

    private CurrentUserContext GetCurrentUserContext()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("userId")?.Value;

        if (string.IsNullOrEmpty(userIdStr) || !long.TryParse(userIdStr, out var userId))
        {
            throw new ForbiddenException("Invalid authentication credentials.");
        }

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
