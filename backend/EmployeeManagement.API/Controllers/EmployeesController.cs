using System.Security.Claims;
using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Employee;
using EmployeeManagement.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EmployeeManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly IEmployeeService _employeeService;

    public EmployeesController(IEmployeeService employeeService)
    {
        _employeeService = employeeService;
    }

    /// <summary>
    /// List employees with search, department/status filters, sorting and pagination (Section 3.2, 8.2).
    /// Access enforced in service: Admin sees all; Manager sees own team; Employee sees only themselves.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetEmployees([FromQuery] EmployeeQueryParameters parameters)
    {
        var result = await _employeeService.GetEmployeesAsync(parameters, GetCurrentUserContext());
        return Ok(result);
    }

    /// <summary>
    /// Get single employee by ID (FR-EMP-05, Section 8.2).
    /// Access enforced in service: Admin sees all; Manager sees own team; Employee sees only themselves (403 otherwise).
    /// </summary>
    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetEmployeeById(long id)
    {
        var result = await _employeeService.GetEmployeeByIdAsync(id, GetCurrentUserContext());
        return Ok(result);
    }

    /// <summary>
    /// Create an employee linked to a user account and department (FR-EMP-01, Section 8.2).
    /// Auto-generates employee code if not provided and seeds leave balances (FR-LEV-09).
    /// Admin only.
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> CreateEmployee([FromBody] CreateEmployeeRequestDto request)
    {
        var result = await _employeeService.CreateEmployeeAsync(request);
        return CreatedAtAction(nameof(GetEmployeeById), new { id = result.Id }, result);
    }

    /// <summary>
    /// Update employee details (FR-EMP-02, Section 8.2).
    /// Admin only.
    /// </summary>
    [HttpPut("{id:long}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> UpdateEmployee(long id, [FromBody] UpdateEmployeeRequestDto request)
    {
        var result = await _employeeService.UpdateEmployeeAsync(id, request);
        return Ok(result);
    }

    /// <summary>
    /// Deactivate employee (soft delete) and deactivate user account (FR-EMP-03, FR-AUTH-05, Section 8.2).
    /// Admin only.
    /// </summary>
    [HttpDelete("{id:long}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> DeactivateEmployee(long id)
    {
        await _employeeService.SoftDeleteEmployeeAsync(id);
        return NoContent();
    }

    private CurrentUserContext GetCurrentUserContext()
    {
        var userIdStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? User.FindFirst("userId")?.Value;
        long.TryParse(userIdStr, out var userId);

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
