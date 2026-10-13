using System.Text.RegularExpressions;
using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Employee;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;

namespace EmployeeManagement.API.Services;

public class EmployeeService : IEmployeeService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<EmployeeService> _logger;

    public EmployeeService(ApplicationDbContext dbContext, ILogger<EmployeeService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task<PagedResult<EmployeeListDto>> GetEmployeesAsync(EmployeeQueryParameters parameters, CurrentUserContext currentUser)
    {
        var query = _dbContext.Employees
            .AsNoTracking()
            .Include(e => e.User)
            .Include(e => e.Department)
            .AsQueryable();

        // Access enforcement in service:
        // Admin sees all; Manager sees only their department (their team); Employee sees only themselves.
        var role = currentUser.Role.ToUpperInvariant();
        if (role == "ADMIN")
        {
            if (parameters.DepartmentId.HasValue)
            {
                query = query.Where(e => e.DepartmentId == parameters.DepartmentId.Value);
            }
        }
        else if (role == "MANAGER")
        {
            var managedDepartment = await _dbContext.Departments
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.ManagerId == currentUser.EmployeeId);

            if (managedDepartment != null)
            {
                query = query.Where(e => e.DepartmentId == managedDepartment.Id);
            }
            else
            {
                // If manager does not lead a department yet, they can only see themselves
                query = query.Where(e => e.Id == currentUser.EmployeeId || e.UserId == currentUser.UserId);
            }
        }
        else if (role == "EMPLOYEE")
        {
            query = query.Where(e => e.Id == currentUser.EmployeeId || e.UserId == currentUser.UserId);
        }
        else
        {
            throw new ForbiddenException("You do not have permission to view employee records.");
        }

        // Status filter
        if (parameters.Status.HasValue)
        {
            query = query.Where(e => e.Status == parameters.Status.Value);
        }

        // Search filter across name, code, email, department, position
        if (!string.IsNullOrWhiteSpace(parameters.Search))
        {
            var search = parameters.Search.Trim().ToLower();
            query = query.Where(e =>
                e.FirstName.ToLower().Contains(search) ||
                e.LastName.ToLower().Contains(search) ||
                (e.FirstName.ToLower() + " " + e.LastName.ToLower()).Contains(search) ||
                e.EmployeeCode.ToLower().Contains(search) ||
                e.User.Email.ToLower().Contains(search) ||
                e.Position.ToLower().Contains(search) ||
                e.Department.Name.ToLower().Contains(search));
        }

        // Sorting
        var isDesc = string.Equals(parameters.SortOrder, "desc", StringComparison.OrdinalIgnoreCase);
        var sortBy = parameters.SortBy?.ToLowerInvariant() ?? "code";

        query = sortBy switch
        {
            "name" => isDesc ? query.OrderByDescending(e => e.FirstName).ThenByDescending(e => e.LastName)
                             : query.OrderBy(e => e.FirstName).ThenBy(e => e.LastName),
            "firstname" => isDesc ? query.OrderByDescending(e => e.FirstName) : query.OrderBy(e => e.FirstName),
            "lastname" => isDesc ? query.OrderByDescending(e => e.LastName) : query.OrderBy(e => e.LastName),
            "employeecode" or "code" => isDesc ? query.OrderByDescending(e => e.EmployeeCode) : query.OrderBy(e => e.EmployeeCode),
            "email" => isDesc ? query.OrderByDescending(e => e.User.Email) : query.OrderBy(e => e.User.Email),
            "department" or "departmentname" => isDesc ? query.OrderByDescending(e => e.Department.Name) : query.OrderBy(e => e.Department.Name),
            "position" => isDesc ? query.OrderByDescending(e => e.Position) : query.OrderBy(e => e.Position),
            "status" => isDesc ? query.OrderByDescending(e => e.Status) : query.OrderBy(e => e.Status),
            "joineddate" => isDesc ? query.OrderByDescending(e => e.JoinedDate) : query.OrderBy(e => e.JoinedDate),
            "createdat" => isDesc ? query.OrderByDescending(e => e.CreatedAt) : query.OrderBy(e => e.CreatedAt),
            _ => isDesc ? query.OrderByDescending(e => e.EmployeeCode) : query.OrderBy(e => e.EmployeeCode)
        };

        var totalCount = await query.CountAsync();
        var page = Math.Max(1, parameters.Page);
        var pageSize = Math.Clamp(parameters.PageSize, 1, 100);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new EmployeeListDto
            {
                Id = e.Id,
                EmployeeCode = e.EmployeeCode,
                FirstName = e.FirstName,
                LastName = e.LastName,
                FullName = $"{e.FirstName} {e.LastName}",
                Email = e.User.Email,
                Phone = e.Phone,
                DepartmentId = e.DepartmentId,
                DepartmentName = e.Department.Name,
                Position = e.Position,
                Status = e.Status.ToString(),
                JoinedDate = e.JoinedDate,
                CreatedAt = e.CreatedAt
            })
            .ToListAsync();

        return new PagedResult<EmployeeListDto>(items, totalCount, page, pageSize);
    }

    public async Task<EmployeeDetailDto> GetEmployeeByIdAsync(long id, CurrentUserContext currentUser)
    {
        var employee = await _dbContext.Employees
            .AsNoTracking()
            .Include(e => e.User)
            .Include(e => e.Department)
            .Include(e => e.ManagedDepartment)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (employee == null)
        {
            throw new NotFoundException($"Employee with ID {id} not found.");
        }

        // Service-level access enforcement:
        // Admin sees all; Manager sees only their department (their team); Employee sees only themselves.
        var role = currentUser.Role.ToUpperInvariant();
        if (role == "ADMIN")
        {
            // Allowed
        }
        else if (role == "MANAGER")
        {
            bool isSelf = (currentUser.EmployeeId.HasValue && currentUser.EmployeeId.Value == employee.Id)
                          || currentUser.UserId == employee.UserId;

            if (!isSelf)
            {
                var managedDepartment = await _dbContext.Departments
                    .AsNoTracking()
                    .FirstOrDefaultAsync(d => d.ManagerId == currentUser.EmployeeId);

                if (managedDepartment == null || employee.DepartmentId != managedDepartment.Id)
                {
                    _logger.LogWarning("Manager (EmployeeId: {ManagerEmpId}) attempted unauthorized access to Employee ID {TargetEmpId}",
                        currentUser.EmployeeId, id);
                    throw new ForbiddenException("You do not have permission to view this employee record.");
                }
            }
        }
        else if (role == "EMPLOYEE")
        {
            bool isSelf = (currentUser.EmployeeId.HasValue && currentUser.EmployeeId.Value == employee.Id)
                          || currentUser.UserId == employee.UserId;

            if (!isSelf)
            {
                _logger.LogWarning("Employee (UserId: {UserId}) attempted unauthorized access to Employee ID {TargetEmpId}",
                    currentUser.UserId, id);
                throw new ForbiddenException("You do not have permission to view this employee record.");
            }
        }
        else
        {
            throw new ForbiddenException("You do not have permission to view this employee record.");
        }

        return MapToDetailDto(employee);
    }

    public async Task<EmployeeDetailDto> CreateEmployeeAsync(CreateEmployeeRequestDto request)
    {
        var user = await _dbContext.Users
            .Include(u => u.Employee)
            .FirstOrDefaultAsync(u => u.Id == request.UserId);

        if (user == null)
        {
            throw new NotFoundException($"User with ID {request.UserId} not found.");
        }

        if (user.Employee != null)
        {
            throw new ConflictException($"User with ID {request.UserId} already has an associated employee profile.");
        }

        var department = await _dbContext.Departments
            .FirstOrDefaultAsync(d => d.Id == request.DepartmentId);

        if (department == null)
        {
            throw new NotFoundException($"Department with ID {request.DepartmentId} not found.");
        }

        // Auto-generate employee code (EMP001, EMP002...) if not provided
        string employeeCode;
        if (!string.IsNullOrWhiteSpace(request.EmployeeCode))
        {
            employeeCode = request.EmployeeCode.Trim().ToUpperInvariant();
            if (await _dbContext.Employees.AnyAsync(e => e.EmployeeCode.ToLower() == employeeCode.ToLower()))
            {
                throw new ConflictException($"Employee code '{employeeCode}' already exists.");
            }
        }
        else
        {
            employeeCode = await GenerateNextEmployeeCodeAsync();
        }

        var employee = new Employee
        {
            UserId = user.Id,
            DepartmentId = department.Id,
            EmployeeCode = employeeCode,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Phone = request.Phone?.Trim(),
            Position = request.Position.Trim(),
            JoinedDate = request.JoinedDate ?? DateOnly.FromDateTime(DateTime.UtcNow),
            Status = EmployeeStatus.ACTIVE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _dbContext.Employees.AddAsync(employee);
        await _dbContext.SaveChangesAsync();

        // Auto-create leave balances for the current year for all active leave types (FR-LEV-09)
        var currentYear = DateTime.UtcNow.Year;
        var activeLeaveTypes = await _dbContext.LeaveTypes
            .Where(lt => lt.IsActive)
            .ToListAsync();

        foreach (var lt in activeLeaveTypes)
        {
            _dbContext.LeaveBalances.Add(new LeaveBalance
            {
                EmployeeId = employee.Id,
                LeaveTypeId = lt.Id,
                Year = currentYear,
                AllocatedDays = lt.DefaultDays,
                UsedDays = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Employee {EmployeeCode} ({Name}) created with ID {EmployeeId}",
            employee.EmployeeCode, employee.FullName, employee.Id);

        // Load navigation properties for response
        employee.User = user;
        employee.Department = department;

        return MapToDetailDto(employee);
    }

    public async Task<EmployeeDetailDto> UpdateEmployeeAsync(long id, UpdateEmployeeRequestDto request)
    {
        var employee = await _dbContext.Employees
            .Include(e => e.User)
            .Include(e => e.Department)
            .Include(e => e.ManagedDepartment)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (employee == null)
        {
            throw new NotFoundException($"Employee with ID {id} not found.");
        }

        var department = await _dbContext.Departments.FirstOrDefaultAsync(d => d.Id == request.DepartmentId);
        if (department == null)
        {
            throw new NotFoundException($"Department with ID {request.DepartmentId} not found.");
        }

        employee.DepartmentId = department.Id;
        employee.Department = department;
        employee.FirstName = request.FirstName.Trim();
        employee.LastName = request.LastName.Trim();
        employee.Phone = request.Phone?.Trim();
        employee.Position = request.Position.Trim();

        if (request.JoinedDate.HasValue)
        {
            employee.JoinedDate = request.JoinedDate.Value;
        }

        if (request.Status.HasValue)
        {
            employee.Status = request.Status.Value;
            // When employee status changes to INACTIVE, also deactivate the user account (FR-AUTH-05)
            if (employee.Status == EmployeeStatus.INACTIVE)
            {
                employee.User.IsActive = false;
            }
            else if (employee.Status == EmployeeStatus.ACTIVE)
            {
                employee.User.IsActive = true;
            }
        }

        employee.UpdatedAt = DateTime.UtcNow;
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Employee ID {EmployeeId} updated", employee.Id);

        return MapToDetailDto(employee);
    }

    public async Task SoftDeleteEmployeeAsync(long id)
    {
        var employee = await _dbContext.Employees
            .Include(e => e.User)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (employee == null)
        {
            throw new NotFoundException($"Employee with ID {id} not found.");
        }

        // Soft delete: status INACTIVE, also deactivating the user so they cannot log in (FR-AUTH-05, FR-EMP-03)
        employee.Status = EmployeeStatus.INACTIVE;
        employee.User.IsActive = false;
        employee.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Employee ID {EmployeeId} ({Code}) soft-deleted (status set to INACTIVE, user deactivated)",
            employee.Id, employee.EmployeeCode);
    }

    public async Task<string> GenerateNextEmployeeCodeAsync()
    {
        var existingCodes = await _dbContext.Employees
            .Select(e => e.EmployeeCode)
            .ToListAsync();

        int maxNumber = 0;
        foreach (var code in existingCodes)
        {
            var match = Regex.Match(code, @"EMP-?(\d+)", RegexOptions.IgnoreCase);
            if (match.Success && int.TryParse(match.Groups[1].Value, out var num))
            {
                if (num > maxNumber)
                {
                    maxNumber = num;
                }
            }
        }

        var nextNum = maxNumber + 1;
        var candidate = $"EMP{nextNum:D3}";

        while (existingCodes.Contains(candidate, StringComparer.OrdinalIgnoreCase))
        {
            nextNum++;
            candidate = $"EMP{nextNum:D3}";
        }

        return candidate;
    }

    private static EmployeeDetailDto MapToDetailDto(Employee employee)
    {
        return new EmployeeDetailDto
        {
            Id = employee.Id,
            UserId = employee.UserId,
            EmployeeCode = employee.EmployeeCode,
            FirstName = employee.FirstName,
            LastName = employee.LastName,
            FullName = $"{employee.FirstName} {employee.LastName}",
            Email = employee.User?.Email ?? string.Empty,
            Role = employee.User?.Role.ToString() ?? string.Empty,
            Phone = employee.Phone,
            DepartmentId = employee.DepartmentId,
            DepartmentName = employee.Department?.Name ?? string.Empty,
            Position = employee.Position,
            Status = employee.Status.ToString(),
            JoinedDate = employee.JoinedDate,
            ManagedDepartmentId = employee.ManagedDepartment?.Id,
            ManagedDepartmentName = employee.ManagedDepartment?.Name,
            CreatedAt = employee.CreatedAt,
            UpdatedAt = employee.UpdatedAt
        };
    }
}
