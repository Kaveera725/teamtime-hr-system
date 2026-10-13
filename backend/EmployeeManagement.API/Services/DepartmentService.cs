using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Department;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;

namespace EmployeeManagement.API.Services;

public class DepartmentService : IDepartmentService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<DepartmentService> _logger;

    public DepartmentService(ApplicationDbContext dbContext, ILogger<DepartmentService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<IReadOnlyList<DepartmentDto>> GetAllDepartmentsAsync()
    {
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

    public async Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentRequestDto request)
    {
        var normalizedName = request.Name.Trim();

        if (await _dbContext.Departments.AnyAsync(d => d.Name.ToLower() == normalizedName.ToLower()))
        {
            throw new ConflictException($"Department with name '{normalizedName}' already exists.");
        }

        Employee? manager = null;
        if (request.ManagerId.HasValue)
        {
            manager = await _dbContext.Employees.FirstOrDefaultAsync(e => e.Id == request.ManagerId.Value);
            if (manager == null)
            {
                throw new NotFoundException($"Employee with ID {request.ManagerId.Value} not found.");
            }
        }

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

    public async Task<DepartmentDto> UpdateDepartmentAsync(long id, UpdateDepartmentRequestDto request)
    {
        var department = await _dbContext.Departments
            .Include(d => d.Manager)
            .Include(d => d.Employees)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (department == null)
        {
            throw new NotFoundException($"Department with ID {id} not found.");
        }

        var normalizedName = request.Name.Trim();
        if (await _dbContext.Departments.AnyAsync(d => d.Id != id && d.Name.ToLower() == normalizedName.ToLower()))
        {
            throw new ConflictException($"Department with name '{normalizedName}' already exists.");
        }

        Employee? manager = null;
        if (request.ManagerId.HasValue)
        {
            manager = await _dbContext.Employees.FirstOrDefaultAsync(e => e.Id == request.ManagerId.Value);
            if (manager == null)
            {
                throw new NotFoundException($"Employee with ID {request.ManagerId.Value} not found.");
            }
        }

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
