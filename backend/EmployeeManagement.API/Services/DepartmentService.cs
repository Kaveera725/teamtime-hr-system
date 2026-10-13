using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Department;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;

namespace EmployeeManagement.API.Services;

/// <summary>
/// Service implementing business logic and data access for Department Management (Sections 3.3 and 8.3).
/// Handles listing departments with manager details and employee headcounts, creating departments,
/// and updating department information including assigning managers.
/// </summary>
public class DepartmentService : IDepartmentService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<DepartmentService> _logger;

    public DepartmentService(ApplicationDbContext dbContext, ILogger<DepartmentService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Retrieves all departments with their current employee count and manager full name (FR-DEP-01).
    /// Open to all authenticated users for UI dropdowns, directory views, and department listings.
    /// </summary>
    /// <returns>A read-only list of <see cref="DepartmentDto"/> items ordered alphabetically by name.</returns>
    public async Task<IReadOnlyList<DepartmentDto>> GetAllDepartmentsAsync()
    {
        // Query departments without tracking entities for read-only performance optimization.
        // Eager-load Manager and Employees navigation properties to calculate counts and display manager full name.
        var departments = await _dbContext.Departments
            .AsNoTracking()
            .Include(d => d.Manager)
            .Include(d => d.Employees)
            .OrderBy(d => d.Name)
            .Select(d => new DepartmentDto
            {
                Id = d.Id,
                Name = d.Name,
                Description = d.Description,
                ManagerId = d.ManagerId,
                ManagerName = d.Manager != null ? $"{d.Manager.FirstName} {d.Manager.LastName}" : null,
                EmployeeCount = d.Employees.Count,
                CreatedAt = d.CreatedAt
            })
            .ToListAsync();

        return departments;
    }

    /// <summary>
    /// Retrieves a single department by its unique primary key identifier.
    /// </summary>
    /// <param name="id">The unique ID of the department.</param>
    /// <returns>The department details encapsulated in a <see cref="DepartmentDto"/>.</returns>
    /// <exception cref="NotFoundException">Thrown when no department exists with the specified ID.</exception>
    public async Task<DepartmentDto> GetDepartmentByIdAsync(long id)
    {
        var department = await _dbContext.Departments
            .AsNoTracking()
            .Include(d => d.Manager)
            .Include(d => d.Employees)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (department == null)
        {
            throw new NotFoundException($"Department with ID {id} not found.");
        }

        return new DepartmentDto
        {
            Id = department.Id,
            Name = department.Name,
            Description = department.Description,
            ManagerId = department.ManagerId,
            ManagerName = department.Manager != null ? $"{department.Manager.FirstName} {department.Manager.LastName}" : null,
            EmployeeCount = department.Employees.Count,
            CreatedAt = department.CreatedAt
        };
    }

    /// <summary>
    /// Creates a new department record (FR-DEP-01). Admin-only write operation.
    /// </summary>
    /// <param name="request">The department creation payload containing name, description, and optional manager ID.</param>
    /// <returns>The newly created department as a <see cref="DepartmentDto"/>.</returns>
    /// <exception cref="ConflictException">Thrown when a department with the same name already exists.</exception>
    /// <exception cref="NotFoundException">Thrown when the specified ManagerId does not match any existing employee.</exception>
    public async Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentRequestDto request)
    {
        var normalizedName = request.Name.Trim();

        // Check uniqueness constraint on department name (Section 7.9)
        if (await _dbContext.Departments.AnyAsync(d => d.Name.ToLower() == normalizedName.ToLower()))
        {
            throw new ConflictException($"Department with name '{normalizedName}' already exists.");
        }

        // Validate that the assigned manager exists if a ManagerId was specified
        Employee? manager = null;
        if (request.ManagerId.HasValue)
        {
            manager = await _dbContext.Employees.FirstOrDefaultAsync(e => e.Id == request.ManagerId.Value);
            if (manager == null)
            {
                throw new NotFoundException($"Employee with ID {request.ManagerId.Value} not found.");
            }
        }

        // Instantiate and persist the department entity
        var department = new Department
        {
            Name = normalizedName,
            Description = request.Description?.Trim(),
            ManagerId = request.ManagerId,
            CreatedAt = DateTime.UtcNow
        };

        await _dbContext.Departments.AddAsync(department);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Department '{DepartmentName}' created with ID {DepartmentId}", department.Name, department.Id);

        return new DepartmentDto
        {
            Id = department.Id,
            Name = department.Name,
            Description = department.Description,
            ManagerId = department.ManagerId,
            ManagerName = manager != null ? $"{manager.FirstName} {manager.LastName}" : null,
            EmployeeCount = 0,
            CreatedAt = department.CreatedAt
        };
    }

    /// <summary>
    /// Updates an existing department's name, description, or assigns a manager (FR-DEP-01, FR-DEP-02).
    /// Admin-only write operation.
    /// </summary>
    /// <param name="id">The unique ID of the department to update.</param>
    /// <param name="request">The update payload containing modified values.</param>
    /// <returns>The updated department representation as a <see cref="DepartmentDto"/>.</returns>
    /// <exception cref="NotFoundException">Thrown if the department or the assigned manager does not exist.</exception>
    /// <exception cref="ConflictException">Thrown if the updated department name conflicts with another department.</exception>
    public async Task<DepartmentDto> UpdateDepartmentAsync(long id, UpdateDepartmentRequestDto request)
    {
        // Retrieve existing department entity
        var department = await _dbContext.Departments
            .Include(d => d.Manager)
            .Include(d => d.Employees)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (department == null)
        {
            throw new NotFoundException($"Department with ID {id} not found.");
        }

        // Validate unique department name across all other existing departments
        var normalizedName = request.Name.Trim();
        if (await _dbContext.Departments.AnyAsync(d => d.Id != id && d.Name.ToLower() == normalizedName.ToLower()))
        {
            throw new ConflictException($"Department with name '{normalizedName}' already exists.");
        }

        // Validate that the assigned manager exists if provided
        Employee? manager = null;
        if (request.ManagerId.HasValue)
        {
            manager = await _dbContext.Employees.FirstOrDefaultAsync(e => e.Id == request.ManagerId.Value);
            if (manager == null)
            {
                throw new NotFoundException($"Employee with ID {request.ManagerId.Value} not found.");
            }
        }

        // Apply property updates
        department.Name = normalizedName;
        department.Description = request.Description?.Trim();
        department.ManagerId = request.ManagerId;

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Department ID {DepartmentId} updated", department.Id);

        return new DepartmentDto
        {
            Id = department.Id,
            Name = department.Name,
            Description = department.Description,
            ManagerId = department.ManagerId,
            ManagerName = manager != null ? $"{manager.FirstName} {manager.LastName}" : null,
            EmployeeCount = department.Employees.Count,
            CreatedAt = department.CreatedAt
        };
    }
}
