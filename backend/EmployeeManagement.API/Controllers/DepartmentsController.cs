using EmployeeManagement.API.DTOs.Department;
using EmployeeManagement.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EmployeeManagement.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DepartmentsController : ControllerBase
{
    private readonly IDepartmentService _departmentService;

    public DepartmentsController(IDepartmentService departmentService)
    {
        _departmentService = departmentService;
    }

    /// <summary>
    /// List all departments with manager names and employee counts (Section 3.3, 8.3).
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllDepartments()
    {
        var departments = await _departmentService.GetAllDepartmentsAsync();
        return Ok(departments);
    }

    /// <summary>
    /// Retrieve a single department by ID.
    /// </summary>
    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetDepartmentById(long id)
    {
        var department = await _departmentService.GetDepartmentByIdAsync(id);
        return Ok(department);
    }

    /// <summary>
    /// Create a new department (Admin only per FR-DEP-01).
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> CreateDepartment([FromBody] CreateDepartmentRequestDto request)
    {
        var created = await _departmentService.CreateDepartmentAsync(request);
        return CreatedAtAction(nameof(GetDepartmentById), new { id = created.Id }, created);
    }

    /// <summary>
    /// Update department details and assign manager (Admin only per FR-DEP-01, FR-DEP-02).
    /// </summary>
    [HttpPut("{id:long}")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> UpdateDepartment(long id, [FromBody] UpdateDepartmentRequestDto request)
    {
        var updated = await _departmentService.UpdateDepartmentAsync(id, request);
        return Ok(updated);
    }
}
