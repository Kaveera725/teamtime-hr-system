using System.Text.RegularExpressions;
using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Employee;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;

namespace EmployeeManagement.API.Services;

/// <summary>
/// Service implementing business logic, resource-level access enforcement, and data operations
/// for Employee Management (Sections 3.2, 8.2, FR-EMP-01 through FR-EMP-05, FR-LEV-09, FR-AUTH-05, NFR-01).
/// </summary>
public class EmployeeService : IEmployeeService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILeaveBalanceService _leaveBalanceService;
    private readonly ILogger<EmployeeService> _logger;

    public EmployeeService(ApplicationDbContext dbContext, ILogger<EmployeeService> logger, ILeaveBalanceService? leaveBalanceService = null)
    {
        _dbContext = dbContext;
        _logger = logger;
        _leaveBalanceService = leaveBalanceService ?? new LeaveBalanceService(dbContext, LoggerFactory.Create(b => b.AddConsole()).CreateLogger<LeaveBalanceService>());
    }

    /// <summary>
    /// Retrieves a paginated list of employees with search, department/status filtering, and sorting (FR-EMP-04).
    /// Enforces resource-level data boundaries directly in the service:
    /// - Admin: Sees all employees across the organization.
    /// - Manager: Sees only employees in their managed department (their team).
    /// - Employee: Sees only their own employee profile.
    /// </summary>
    /// <param name="parameters">Filtering, sorting, and pagination options.</param>
    /// <param name="currentUser">The authenticated user's ID, role, and associated employee ID.</param>
    /// <returns>A <see cref="PagedResult{EmployeeListDto}"/> containing the matching records and pagination metadata.</returns>
    /// <exception cref="ForbiddenException">Thrown if the user has an unrecognized role or insufficient access.</exception>
    public async Task<PagedResult<EmployeeListDto>> GetEmployeesAsync(EmployeeQueryParameters parameters, CurrentUserContext currentUser)
    {
        var query = _dbContext.Employees
            .AsNoTracking()
            .Include(e => e.User)
            .Include(e => e.Department)
            .AsQueryable();

        // -------------------------------------------------------------------------
        // 1. Role-Based Scope Enforcement (Service Layer)
        // -------------------------------------------------------------------------
        var role = currentUser.Role.ToUpperInvariant();
        if (role == "ADMIN")
        {
            // Admin can view all employees. Optional department filter applied below if passed in parameters.
            if (parameters.DepartmentId.HasValue)
            {
                query = query.Where(e => e.DepartmentId == parameters.DepartmentId.Value);
            }
        }
        else if (role == "MANAGER")
        {
            // Manager sees only their department team members
            var managedDepartment = await _dbContext.Departments
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.ManagerId == currentUser.EmployeeId);

            if (managedDepartment != null)
            {
                query = query.Where(e => e.DepartmentId == managedDepartment.Id);
            }
            else
            {
                // If a manager does not manage a department yet, they can only view themselves
                query = query.Where(e => e.Id == currentUser.EmployeeId || e.UserId == currentUser.UserId);
            }
        }
        else if (role == "EMPLOYEE")
        {
            // Regular employees can only view their own profile
            query = query.Where(e => e.Id == currentUser.EmployeeId || e.UserId == currentUser.UserId);
        }
        else
        {
            throw new ForbiddenException("You do not have permission to view employee records.");
        }

        // -------------------------------------------------------------------------
        // 2. Status Filter
        // -------------------------------------------------------------------------
        if (parameters.Status.HasValue)
        {
            query = query.Where(e => e.Status == parameters.Status.Value);
        }

        // -------------------------------------------------------------------------
        // 3. Search Filter across names, employee code, email, department, position
        // -------------------------------------------------------------------------
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

        // -------------------------------------------------------------------------
        // 4. Sorting
        // -------------------------------------------------------------------------
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

        // -------------------------------------------------------------------------
        // 5. Pagination & Projection into EmployeeListDto
        // -------------------------------------------------------------------------
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

    /// <summary>
    /// Retrieves a single employee record by ID with resource-level authorization checks (FR-EMP-05).
    /// - Admin: Can view any employee record.
    /// - Manager: Can view themselves or members of their managed department.
    /// - Employee: Can only view their own employee record.
    /// </summary>
    /// <param name="id">The target employee ID.</param>
    /// <param name="currentUser">The authenticated caller's identity context.</param>
    /// <returns>The employee details as an <see cref="EmployeeDetailDto"/>.</returns>
    /// <exception cref="NotFoundException">Thrown if the employee record does not exist.</exception>
    /// <exception cref="ForbiddenException">Thrown if the caller lacks authorization to view the requested record.</exception>
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

        // Resource-level access checks enforced in service
        var role = currentUser.Role.ToUpperInvariant();
        if (role == "ADMIN")
        {
            // Allowed: Administrator has organization-wide read access
        }
        else if (role == "MANAGER")
        {
            bool isSelf = (currentUser.EmployeeId.HasValue && currentUser.EmployeeId.Value == employee.Id)
                          || currentUser.UserId == employee.UserId;

            if (!isSelf)
            {
                // Verify target employee belongs to this manager's department
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
            // Employees may ONLY access their own profile
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

    /// <summary>
    /// Creates a new employee linked to a user account and department (FR-EMP-01).
    /// Auto-generates sequential employee codes (EMP001, EMP002...) if omitted,
    /// and automatically seeds initial leave balances for all active leave types for the current year (FR-LEV-09).
    /// </summary>
    /// <param name="request">The creation payload.</param>
    /// <returns>The newly created employee as an <see cref="EmployeeDetailDto"/>.</returns>
    /// <exception cref="NotFoundException">Thrown if the specified user or department does not exist.</exception>
    /// <exception cref="ConflictException">Thrown if the user already has an employee profile or the code is already taken.</exception>
    public async Task<EmployeeDetailDto> CreateEmployeeAsync(CreateEmployeeRequestDto request)
    {
        // 1. Verify User exists and is not already associated with an employee profile
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

        // 2. Verify Department exists
        var department = await _dbContext.Departments
            .FirstOrDefaultAsync(d => d.Id == request.DepartmentId);

        if (department == null)
        {
            throw new NotFoundException($"Department with ID {request.DepartmentId} not found.");
        }

        // 3. Resolve or generate employee code (EMP001, EMP002...)
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

        // 4. Create Employee record
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

        // 5. Auto-seed initial leave balances for the new employee (FR-LEV-09)
        var currentYear = DateTime.UtcNow.Year;
        await _leaveBalanceService.CreateBalancesForEmployeeAsync(employee.Id, currentYear);

        _logger.LogInformation("Employee {EmployeeCode} ({Name}) created with ID {EmployeeId}",
            employee.EmployeeCode, employee.FullName, employee.Id);

        // Load references for return DTO
        employee.User = user;
        employee.Department = department;

        return MapToDetailDto(employee);
    }

    /// <summary>
    /// Updates employee details (FR-EMP-02).
    /// If status is changed to INACTIVE, also synchronizes and deactivates the user account (FR-AUTH-05).
    /// </summary>
    /// <param name="id">The employee ID to update.</param>
    /// <param name="request">The update payload.</param>
    /// <returns>The updated employee as an <see cref="EmployeeDetailDto"/>.</returns>
    /// <exception cref="NotFoundException">Thrown if the employee or department is not found.</exception>
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

            // When employee status changes to INACTIVE, also deactivate user account so they cannot log in (FR-AUTH-05)
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

    /// <summary>
    /// Performs a soft delete on an employee record (FR-EMP-03).
    /// Records are never hard-deleted; employee status is set to INACTIVE and the associated user account
    /// is deactivated so they cannot log in (FR-AUTH-05).
    /// </summary>
    /// <param name="id">The employee ID to deactivate.</param>
    /// <exception cref="NotFoundException">Thrown if the employee does not exist.</exception>
    public async Task SoftDeleteEmployeeAsync(long id)
    {
        var employee = await _dbContext.Employees
            .Include(e => e.User)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (employee == null)
        {
            throw new NotFoundException($"Employee with ID {id} not found.");
        }

        // Soft delete: status INACTIVE, and deactivate the login user (FR-AUTH-05, FR-EMP-03)
        employee.Status = EmployeeStatus.INACTIVE;
        employee.User.IsActive = false;
        employee.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Employee ID {EmployeeId} ({Code}) soft-deleted (status set to INACTIVE, user deactivated)",
            employee.Id, employee.EmployeeCode);
    }

    /// <summary>
    /// Auto-generates the next sequential employee code following the EMP001, EMP002, ... standard.
    /// Parses existing codes, identifies the maximum numeric suffix, and guarantees uniqueness.
    /// </summary>
    /// <returns>A unique employee code string.</returns>
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

        // Guarantee candidate is not present in existing codes
        while (existingCodes.Contains(candidate, StringComparer.OrdinalIgnoreCase))
        {
            nextNum++;
            candidate = $"EMP{nextNum:D3}";
        }

        return candidate;
    }

    /// <summary>
    /// Maps an Employee entity into an EmployeeDetailDto for API responses.
    /// </summary>
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
