using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Leave;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;

namespace EmployeeManagement.API.Services;

public class LeaveService : ILeaveService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<LeaveService> _logger;

    public LeaveService(ApplicationDbContext dbContext, ILogger<LeaveService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Submits a leave request adhering strictly to Section 5.2 validation sequence:
    /// 1. Employee exists and is ACTIVE.
    /// 2. Leave type exists and is active.
    /// 3. Date rules: EndDate >= StartDate, single calendar year (BR-08), past-date rule (BR-09).
    /// 4. Day calculation: Mon-Fri working days, half-day support (BR-01, BR-02), rejects zero working days.
    /// 5. Overlap rejection with PENDING or APPROVED requests (BR-03).
    /// 6. Balance check: requested days <= remaining minus pending (BR-04, No Pay exempt).
    /// 7. Create request with status PENDING.
    /// </summary>
    public async Task<LeaveRequestDto> CreateAsync(long userId, CreateLeaveRequestDto request)
    {
        // 1. Employee exists and is active
        var employee = await _dbContext.Employees
            .Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.UserId == userId);

        if (employee == null)
        {
            throw new NotFoundException("Employee profile not found for the current user.");
        }

        if (employee.Status != EmployeeStatus.ACTIVE)
        {
            throw new BusinessRuleException("Employee is not active and cannot apply for leave.");
        }

        // 2. Leave type exists and is active
        var leaveType = await _dbContext.LeaveTypes
            .FirstOrDefaultAsync(lt => lt.Id == request.LeaveTypeId);

        if (leaveType == null)
        {
            throw new NotFoundException($"Leave type with ID {request.LeaveTypeId} not found.");
        }

        if (!leaveType.IsActive)
        {
            throw new BusinessRuleException($"Leave type '{leaveType.Name}' is not active.");
        }

        // 3. Date rules
        if (request.EndDate < request.StartDate)
        {
            throw new BusinessRuleException("End date cannot be earlier than start date.");
        }

        // BR-08: Year boundary - Cannot span across calendar years
        if (request.StartDate.Year != request.EndDate.Year)
        {
            throw new BusinessRuleException("A leave request cannot span two calendar years. Please submit separate requests for each year.");
        }

        // BR-09: Past dates - Today or later, except Medical Leave backdatable up to 3 days
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        bool isMedical = string.Equals(leaveType.Name, "Medical Leave", StringComparison.OrdinalIgnoreCase);
        var minDate = isMedical ? today.AddDays(-3) : today;

        if (request.StartDate < minDate)
        {
            throw new BusinessRuleException(
                isMedical
                    ? "Medical leave cannot be backdated more than 3 days."
                    : "Leave start date must be today or in the future.");
        }

        // 4. Calculate total days using BR-01 and BR-02 (pure calculator, rejects zero working days)
        var totalDays = LeaveDayCalculator.CalculateWorkingDays(request.StartDate, request.EndDate, request.IsHalfDay);

        // 5. Overlap check with existing PENDING or APPROVED requests (BR-03)
        var hasOverlap = await _dbContext.LeaveRequests
            .AnyAsync(lr => lr.EmployeeId == employee.Id
                         && (lr.Status == LeaveStatus.PENDING || lr.Status == LeaveStatus.APPROVED)
                         && lr.StartDate <= request.EndDate
                         && lr.EndDate >= request.StartDate);

        if (hasOverlap)
        {
            throw new ConflictException("The requested leave dates overlap with an existing pending or approved leave request.");
        }

        // 6. Sufficient balance check (BR-04, No Pay Leave is exempt)
        bool isNoPay = string.Equals(leaveType.Name, "No Pay Leave", StringComparison.OrdinalIgnoreCase);
        if (!isNoPay)
        {
            var balance = await _dbContext.LeaveBalances
                .FirstOrDefaultAsync(lb => lb.EmployeeId == employee.Id
                                        && lb.LeaveTypeId == leaveType.Id
                                        && lb.Year == request.StartDate.Year);

            if (balance == null)
            {
                throw new BusinessRuleException($"No leave balance found for '{leaveType.Name}' in year {request.StartDate.Year}.");
            }

            var pendingDays = await _dbContext.LeaveRequests
                .Where(lr => lr.EmployeeId == employee.Id
                          && lr.LeaveTypeId == leaveType.Id
                          && lr.Status == LeaveStatus.PENDING
                          && lr.StartDate.Year == request.StartDate.Year)
                .SumAsync(lr => lr.TotalDays);

            var availableBalance = balance.AllocatedDays - balance.UsedDays - pendingDays;
            if (totalDays > availableBalance)
            {
                throw new BusinessRuleException(
                    $"Insufficient leave balance. Available: {availableBalance:0.#} days (Allocated: {balance.AllocatedDays:0.#}, Used: {balance.UsedDays:0.#}, Pending: {pendingDays:0.#}), Requested: {totalDays:0.#} days.");
            }
        }

        // 7. Create request with status PENDING
        var leaveRequest = new LeaveRequest
        {
            EmployeeId = employee.Id,
            LeaveTypeId = leaveType.Id,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            TotalDays = totalDays,
            Reason = request.Reason?.Trim(),
            Status = LeaveStatus.PENDING,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.LeaveRequests.Add(leaveRequest);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Leave request created successfully: ID {LeaveRequestId}, Employee {EmployeeId}, {TotalDays} days",
            leaveRequest.Id, employee.Id, totalDays);

        return MapToDto(leaveRequest, employee, leaveType, null);
    }

    /// <summary>
    /// Calculates preview metrics (working days, balance after, rule validation errors) without persisting.
    /// Provides the live estimate for UI live forms.
    /// </summary>
    public async Task<LeaveRequestPreviewResponseDto> PreviewAsync(long userId, LeaveRequestPreviewRequestDto request)
    {
        var validationErrors = new List<string>();

        var employee = await _dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.UserId == userId);

        if (employee == null)
        {
            validationErrors.Add("Employee profile not found for current user.");
        }
        else if (employee.Status != EmployeeStatus.ACTIVE)
        {
            validationErrors.Add("Employee is not active.");
        }

        var leaveType = await _dbContext.LeaveTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(lt => lt.Id == request.LeaveTypeId);

        if (leaveType == null)
        {
            validationErrors.Add($"Leave type with ID {request.LeaveTypeId} not found.");
        }
        else if (!leaveType.IsActive)
        {
            validationErrors.Add($"Leave type '{leaveType.Name}' is not active.");
        }

        // Date rules
        if (request.EndDate < request.StartDate)
        {
            validationErrors.Add("End date cannot be earlier than start date.");
        }

        if (request.StartDate.Year != request.EndDate.Year)
        {
            validationErrors.Add("A leave request cannot span two calendar years. Please submit separate requests for each year.");
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        bool isMedical = leaveType != null && string.Equals(leaveType.Name, "Medical Leave", StringComparison.OrdinalIgnoreCase);
        var minDate = isMedical ? today.AddDays(-3) : today;

        if (request.StartDate < minDate)
        {
            validationErrors.Add(isMedical
                ? "Medical leave cannot be backdated more than 3 days."
                : "Leave start date must be today or in the future.");
        }

        // Calculate working days
        decimal workingDays = 0m;
        if (request.EndDate >= request.StartDate)
        {
            if (LeaveDayCalculator.TryCalculateWorkingDays(request.StartDate, request.EndDate, request.IsHalfDay, out var calculatedDays, out var calcError))
            {
                workingDays = calculatedDays;
            }
            else if (!string.IsNullOrEmpty(calcError))
            {
                validationErrors.Add(calcError);
            }
        }

        // Check overlap if employee is found and dates are valid
        if (employee != null && request.EndDate >= request.StartDate)
        {
            var hasOverlap = await _dbContext.LeaveRequests
                .AnyAsync(lr => lr.EmployeeId == employee.Id
                             && (lr.Status == LeaveStatus.PENDING || lr.Status == LeaveStatus.APPROVED)
                             && lr.StartDate <= request.EndDate
                             && lr.EndDate >= request.StartDate);

            if (hasOverlap)
            {
                validationErrors.Add("The requested leave dates overlap with an existing pending or approved leave request.");
            }
        }

        // Balance check
        decimal allocated = 0m;
        decimal used = 0m;
        decimal pending = 0m;
        decimal available = 0m;
        decimal balanceAfter = 0m;

        bool isNoPay = leaveType != null && string.Equals(leaveType.Name, "No Pay Leave", StringComparison.OrdinalIgnoreCase);

        if (employee != null && leaveType != null)
        {
            if (isNoPay)
            {
                allocated = 0m;
                used = 0m;
                pending = 0m;
                available = 0m;
                balanceAfter = 0m;
            }
            else
            {
                var balance = await _dbContext.LeaveBalances
                    .AsNoTracking()
                    .FirstOrDefaultAsync(lb => lb.EmployeeId == employee.Id
                                            && lb.LeaveTypeId == leaveType.Id
                                            && lb.Year == request.StartDate.Year);

                if (balance == null)
                {
                    validationErrors.Add($"No leave balance found for '{leaveType.Name}' in year {request.StartDate.Year}.");
                }
                else
                {
                    allocated = balance.AllocatedDays;
                    used = balance.UsedDays;

                    pending = await _dbContext.LeaveRequests
                        .Where(lr => lr.EmployeeId == employee.Id
                                  && lr.LeaveTypeId == leaveType.Id
                                  && lr.Status == LeaveStatus.PENDING
                                  && lr.StartDate.Year == request.StartDate.Year)
                        .SumAsync(lr => lr.TotalDays);

                    available = allocated - used - pending;
                    balanceAfter = available - workingDays;

                    if (workingDays > available)
                    {
                        validationErrors.Add(
                            $"Insufficient leave balance. Available: {available:0.#} days (Allocated: {allocated:0.#}, Used: {used:0.#}, Pending: {pending:0.#}), Requested: {workingDays:0.#} days.");
                    }
                }
            }
        }

        return new LeaveRequestPreviewResponseDto
        {
            WorkingDays = workingDays,
            AllocatedDays = allocated,
            UsedDays = used,
            PendingDays = pending,
            AvailableBalance = available,
            BalanceAfter = balanceAfter,
            IsValid = validationErrors.Count == 0,
            ValidationErrors = validationErrors
        };
    }

    /// <summary>
    /// Gets the current authenticated employee's leave requests with optional filters and pagination.
    /// </summary>
    public async Task<PagedResult<LeaveRequestDto>> GetMyRequestsAsync(
        long userId,
        LeaveStatus? status,
        int? year,
        int page = 1,
        int pageSize = 20)
    {
        var employee = await _dbContext.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.UserId == userId);

        if (employee == null)
        {
            throw new NotFoundException("Employee profile not found for current user.");
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = _dbContext.LeaveRequests
            .AsNoTracking()
            .Include(lr => lr.LeaveType)
            .Include(lr => lr.ApprovedBy)
            .Where(lr => lr.EmployeeId == employee.Id);

        if (status.HasValue)
        {
            query = query.Where(lr => lr.Status == status.Value);
        }

        if (year.HasValue)
        {
            query = query.Where(lr => lr.StartDate.Year == year.Value || lr.EndDate.Year == year.Value);
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(lr => lr.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtos = items.Select(lr => MapToDto(lr, employee, lr.LeaveType, lr.ApprovedBy)).ToList();

        return new PagedResult<LeaveRequestDto>(dtos, totalCount, page, pageSize);
    }

    /// <summary>
    /// Retrieves leave requests with filtering and pagination. Manager is scoped to team; Admin sees all.
    /// </summary>
    public async Task<PagedResult<LeaveRequestDto>> GetRequestsAsync(
        CurrentUserContext userContext,
        LeaveRequestQueryParameters query)
    {
        if (userContext.Role != "ADMIN" && userContext.Role != "MANAGER")
        {
            throw new ForbiddenException("Only managers and administrators can view team or company leave requests.");
        }

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var dbQuery = _dbContext.LeaveRequests
            .AsNoTracking()
            .Include(lr => lr.Employee)
                .ThenInclude(e => e.Department)
            .Include(lr => lr.LeaveType)
            .Include(lr => lr.ApprovedBy)
            .AsQueryable();

        // Manager scoping: only employees belonging to departments managed by this manager
        if (userContext.Role == "MANAGER")
        {
            var managerEmp = await _dbContext.Employees
                .AsNoTracking()
                .FirstOrDefaultAsync(e => e.UserId == userContext.UserId);

            if (managerEmp == null)
            {
                throw new ForbiddenException("Manager employee profile not found.");
            }

            var managedDeptIds = await _dbContext.Departments
                .Where(d => d.ManagerId == managerEmp.Id)
                .Select(d => d.Id)
                .ToListAsync();

            if (managedDeptIds.Count == 0)
            {
                return new PagedResult<LeaveRequestDto>(Array.Empty<LeaveRequestDto>(), 0, page, pageSize);
            }

            dbQuery = dbQuery.Where(lr => managedDeptIds.Contains(lr.Employee.DepartmentId));
        }

        // Apply filters
        if (query.Status.HasValue)
        {
            dbQuery = dbQuery.Where(lr => lr.Status == query.Status.Value);
        }

        if (query.EmployeeId.HasValue)
        {
            dbQuery = dbQuery.Where(lr => lr.EmployeeId == query.EmployeeId.Value);
        }

        if (query.DepartmentId.HasValue)
        {
            dbQuery = dbQuery.Where(lr => lr.Employee.DepartmentId == query.DepartmentId.Value);
        }

        if (query.From.HasValue)
        {
            dbQuery = dbQuery.Where(lr => lr.EndDate >= query.From.Value);
        }

        if (query.To.HasValue)
        {
            dbQuery = dbQuery.Where(lr => lr.StartDate <= query.To.Value);
        }

        var totalCount = await dbQuery.CountAsync();

        var items = await dbQuery
            .OrderByDescending(lr => lr.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var dtos = items.Select(lr => MapToDto(lr, lr.Employee, lr.LeaveType, lr.ApprovedBy)).ToList();

        return new PagedResult<LeaveRequestDto>(dtos, totalCount, page, pageSize);
    }

    /// <summary>
    /// Retrieves a single leave request by ID with access control (Owner, Team Manager, Admin).
    /// </summary>
    public async Task<LeaveRequestDto> GetByIdAsync(long id, CurrentUserContext userContext)
    {
        var leaveRequest = await _dbContext.LeaveRequests
            .AsNoTracking()
            .Include(lr => lr.Employee)
                .ThenInclude(e => e.Department)
            .Include(lr => lr.LeaveType)
            .Include(lr => lr.ApprovedBy)
            .FirstOrDefaultAsync(lr => lr.Id == id);

        if (leaveRequest == null)
        {
            throw new NotFoundException($"Leave request with ID {id} not found.");
        }

        var currentEmp = await _dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.UserId == userContext.UserId);

        bool isOwner = currentEmp != null && currentEmp.Id == leaveRequest.EmployeeId;
        bool isAdmin = userContext.Role == "ADMIN";
        bool isTeamManager = false;

        if (userContext.Role == "MANAGER" && currentEmp != null)
        {
            isTeamManager = await _dbContext.Departments
                .AnyAsync(d => d.Id == leaveRequest.Employee.DepartmentId && d.ManagerId == currentEmp.Id);
        }

        if (!isOwner && !isAdmin && !isTeamManager)
        {
            throw new ForbiddenException("You do not have permission to view this leave request.");
        }

        return MapToDto(leaveRequest, leaveRequest.Employee, leaveType: leaveRequest.LeaveType, leaveRequest.ApprovedBy);
    }

    /// <summary>
    /// Approves a pending leave request, deducting used_days in the same transaction (BR-05, BR-07, Section 5.1).
    /// Uses PostgreSQL xmin concurrency token to prevent double approvals and return 409 Conflict.
    /// </summary>
    public async Task<LeaveRequestDto> ApproveAsync(long id, CurrentUserContext userContext)
    {
        if (userContext.Role != "ADMIN" && userContext.Role != "MANAGER")
        {
            throw new ForbiddenException("Only managers and administrators can approve leave requests.");
        }

        var approverEmployee = await _dbContext.Employees
            .FirstOrDefaultAsync(e => e.UserId == userContext.UserId);

        if (approverEmployee == null)
        {
            throw new ForbiddenException("Approver employee profile not found.");
        }

        var leaveRequest = await _dbContext.LeaveRequests
            .Include(lr => lr.Employee)
                .ThenInclude(e => e.Department)
            .Include(lr => lr.LeaveType)
            .FirstOrDefaultAsync(lr => lr.Id == id);

        if (leaveRequest == null)
        {
            throw new NotFoundException($"Leave request with ID {id} not found.");
        }

        // BR-07: Never approve own request
        if (approverEmployee.Id == leaveRequest.EmployeeId)
        {
            throw new ForbiddenException("You cannot approve your own leave request.");
        }

        // BR-07: Manager requests are approved by an admin
        bool isRequesterManager = await _dbContext.Departments.AnyAsync(d => d.ManagerId == leaveRequest.EmployeeId);
        if (isRequesterManager && userContext.Role != "ADMIN")
        {
            throw new ForbiddenException("Leave requests from managers must be approved by an administrator.");
        }

        // Manager authority check: must manage the requester's department
        if (userContext.Role == "MANAGER")
        {
            var requesterDeptId = leaveRequest.Employee.DepartmentId;
            bool managesDept = await _dbContext.Departments
                .AnyAsync(d => d.Id == requesterDeptId && d.ManagerId == approverEmployee.Id);

            if (!managesDept)
            {
                throw new ForbiddenException("You can only approve leave requests for employees in your department.");
            }
        }

        // Status transition 5.1: Only PENDING -> APPROVED allowed
        if (leaveRequest.Status != LeaveStatus.PENDING)
        {
            throw new BusinessRuleException($"Cannot approve leave request with status '{leaveRequest.Status}'. Only PENDING requests can be approved.");
        }

        // Atomic update and deduction in one transaction (BR-05, Section 7.7)
        leaveRequest.Status = LeaveStatus.APPROVED;
        leaveRequest.ApprovedById = approverEmployee.Id;
        leaveRequest.ApprovedAt = DateTime.UtcNow;
        leaveRequest.UpdatedAt = DateTime.UtcNow;

        bool isNoPay = string.Equals(leaveRequest.LeaveType.Name, "No Pay Leave", StringComparison.OrdinalIgnoreCase);
        if (!isNoPay)
        {
            var balance = await _dbContext.LeaveBalances
                .FirstOrDefaultAsync(lb => lb.EmployeeId == leaveRequest.EmployeeId
                                        && lb.LeaveTypeId == leaveRequest.LeaveTypeId
                                        && lb.Year == leaveRequest.StartDate.Year);

            if (balance == null)
            {
                throw new BusinessRuleException($"Leave balance not found for year {leaveRequest.StartDate.Year}.");
            }

            if (balance.UsedDays + leaveRequest.TotalDays > balance.AllocatedDays)
            {
                throw new BusinessRuleException(
                    $"Insufficient leave balance to approve request. Allocated: {balance.AllocatedDays:0.#}, Used: {balance.UsedDays:0.#}, Requested: {leaveRequest.TotalDays:0.#}");
            }

            balance.UsedDays += leaveRequest.TotalDays;
            balance.UpdatedAt = DateTime.UtcNow;
        }

        // Save changes - EF Core checks xmin concurrency token on LeaveRequest automatically
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Leave request ID {Id} APPROVED by Employee {ApproverId}. Deducted {TotalDays} days.",
            id, approverEmployee.Id, leaveRequest.TotalDays);

        return MapToDto(leaveRequest, leaveRequest.Employee, leaveRequest.LeaveType, approverEmployee);
    }

    /// <summary>
    /// Rejects a pending leave request with a mandatory rejection reason (BR-07, Section 5.1).
    /// </summary>
    public async Task<LeaveRequestDto> RejectAsync(long id, CurrentUserContext userContext, RejectLeaveRequestDto dto)
    {
        if (userContext.Role != "ADMIN" && userContext.Role != "MANAGER")
        {
            throw new ForbiddenException("Only managers and administrators can reject leave requests.");
        }

        if (string.IsNullOrWhiteSpace(dto?.RejectionReason))
        {
            throw new BusinessRuleException("Rejection reason is required.");
        }

        var approverEmployee = await _dbContext.Employees
            .FirstOrDefaultAsync(e => e.UserId == userContext.UserId);

        if (approverEmployee == null)
        {
            throw new ForbiddenException("Approver employee profile not found.");
        }

        var leaveRequest = await _dbContext.LeaveRequests
            .Include(lr => lr.Employee)
                .ThenInclude(e => e.Department)
            .Include(lr => lr.LeaveType)
            .FirstOrDefaultAsync(lr => lr.Id == id);

        if (leaveRequest == null)
        {
            throw new NotFoundException($"Leave request with ID {id} not found.");
        }

        // BR-07: Never reject own request
        if (approverEmployee.Id == leaveRequest.EmployeeId)
        {
            throw new ForbiddenException("You cannot reject your own leave request.");
        }

        // BR-07: Manager requests are handled by admin
        bool isRequesterManager = await _dbContext.Departments.AnyAsync(d => d.ManagerId == leaveRequest.EmployeeId);
        if (isRequesterManager && userContext.Role != "ADMIN")
        {
            throw new ForbiddenException("Leave requests from managers must be handled by an administrator.");
        }

        // Manager authority check: must manage the requester's department
        if (userContext.Role == "MANAGER")
        {
            var requesterDeptId = leaveRequest.Employee.DepartmentId;
            bool managesDept = await _dbContext.Departments
                .AnyAsync(d => d.Id == requesterDeptId && d.ManagerId == approverEmployee.Id);

            if (!managesDept)
            {
                throw new ForbiddenException("You can only reject leave requests for employees in your department.");
            }
        }

        // Status transition 5.1: Only PENDING -> REJECTED allowed
        if (leaveRequest.Status != LeaveStatus.PENDING)
        {
            throw new BusinessRuleException($"Cannot reject leave request with status '{leaveRequest.Status}'. Only PENDING requests can be rejected.");
        }

        leaveRequest.Status = LeaveStatus.REJECTED;
        leaveRequest.RejectionReason = dto.RejectionReason.Trim();
        leaveRequest.ApprovedById = approverEmployee.Id;
        leaveRequest.ApprovedAt = DateTime.UtcNow;
        leaveRequest.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Leave request ID {Id} REJECTED by Employee {ApproverId}. Reason: {Reason}",
            id, approverEmployee.Id, leaveRequest.RejectionReason);

        return MapToDto(leaveRequest, leaveRequest.Employee, leaveRequest.LeaveType, approverEmployee);
    }

    /// <summary>
    /// Cancels a leave request (Owner only; PENDING or APPROVED before start date per BR-06).
    /// Restores balance in the same transaction if the request was previously approved.
    /// </summary>
    public async Task<LeaveRequestDto> CancelAsync(long id, CurrentUserContext userContext)
    {
        var currentEmployee = await _dbContext.Employees
            .FirstOrDefaultAsync(e => e.UserId == userContext.UserId);

        if (currentEmployee == null)
        {
            throw new NotFoundException("Employee profile not found for current user.");
        }

        var leaveRequest = await _dbContext.LeaveRequests
            .Include(lr => lr.Employee)
                .ThenInclude(e => e.Department)
            .Include(lr => lr.LeaveType)
            .Include(lr => lr.ApprovedBy)
            .FirstOrDefaultAsync(lr => lr.Id == id);

        if (leaveRequest == null)
        {
            throw new NotFoundException($"Leave request with ID {id} not found.");
        }

        // Owner check
        if (leaveRequest.EmployeeId != currentEmployee.Id)
        {
            throw new ForbiddenException("You can only cancel your own leave requests.");
        }

        // Allowed transitions (Section 5.1 & BR-06)
        if (leaveRequest.Status == LeaveStatus.PENDING)
        {
            leaveRequest.Status = LeaveStatus.CANCELLED;
            leaveRequest.UpdatedAt = DateTime.UtcNow;
        }
        else if (leaveRequest.Status == LeaveStatus.APPROVED)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (today >= leaveRequest.StartDate)
            {
                throw new BusinessRuleException("Approved leave requests can only be cancelled before the start date.");
            }

            // Restore days to balance (BR-06)
            bool isNoPay = string.Equals(leaveRequest.LeaveType.Name, "No Pay Leave", StringComparison.OrdinalIgnoreCase);
            if (!isNoPay)
            {
                var balance = await _dbContext.LeaveBalances
                    .FirstOrDefaultAsync(lb => lb.EmployeeId == leaveRequest.EmployeeId
                                            && lb.LeaveTypeId == leaveRequest.LeaveTypeId
                                            && lb.Year == leaveRequest.StartDate.Year);

                if (balance != null)
                {
                    balance.UsedDays = Math.Max(0, balance.UsedDays - leaveRequest.TotalDays);
                    balance.UpdatedAt = DateTime.UtcNow;
                }
            }

            leaveRequest.Status = LeaveStatus.CANCELLED;
            leaveRequest.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            // Terminal states (REJECTED, CANCELLED) cannot be cancelled
            throw new BusinessRuleException($"Cannot cancel leave request with status '{leaveRequest.Status}'.");
        }

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Leave request ID {Id} CANCELLED by Owner {EmployeeId}. (Restored days if approved: {Days})",
            id, currentEmployee.Id, leaveRequest.TotalDays);

        return MapToDto(leaveRequest, leaveRequest.Employee, leaveRequest.LeaveType, leaveRequest.ApprovedBy);
    }

    private static LeaveRequestDto MapToDto(
        LeaveRequest lr,
        Employee employee,
        LeaveType leaveType,
        Employee? approver)
    {
        return new LeaveRequestDto
        {
            Id = lr.Id,
            EmployeeId = lr.EmployeeId,
            EmployeeCode = employee?.EmployeeCode ?? string.Empty,
            EmployeeName = employee != null ? $"{employee.FirstName} {employee.LastName}".Trim() : string.Empty,
            DepartmentId = employee?.DepartmentId,
            DepartmentName = employee?.Department?.Name,
            LeaveTypeId = lr.LeaveTypeId,
            LeaveTypeName = leaveType?.Name ?? string.Empty,
            StartDate = lr.StartDate,
            EndDate = lr.EndDate,
            TotalDays = lr.TotalDays,
            Reason = lr.Reason,
            Status = lr.Status.ToString(),
            ApprovedById = lr.ApprovedById,
            ApprovedByName = approver != null ? $"{approver.FirstName} {approver.LastName}".Trim() : null,
            ApprovedAt = lr.ApprovedAt,
            RejectionReason = lr.RejectionReason,
            CreatedAt = lr.CreatedAt,
            UpdatedAt = lr.UpdatedAt
        };
    }
}
