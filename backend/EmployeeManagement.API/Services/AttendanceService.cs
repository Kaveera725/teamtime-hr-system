using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Attendance;
using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;

namespace EmployeeManagement.API.Services;

/// <summary>
/// Service managing daily employee attendance, check-ins, check-outs, history, and summaries
/// (Sections 3.4 and 8.4 with BR-10 to BR-14).
/// </summary>
public class AttendanceService : IAttendanceService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AttendanceService> _logger;

    public AttendanceService(ApplicationDbContext dbContext, IConfiguration configuration, ILogger<AttendanceService> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Records daily check-in for the current user's employee profile (FR-ATT-01, BR-10, BR-11).
    /// </summary>
    public async Task<AttendanceDto> CheckInAsync(long userId, CheckInRequestDto? request = null, DateTime? checkInTime = null)
    {
        var effectiveTime = checkInTime ?? DateTime.UtcNow;
        var today = DateOnly.FromDateTime(effectiveTime);

        // 1. Verify working day (BR-10)
        if (!AttendanceRuleEvaluator.IsWorkingDay(today))
        {
            throw new BusinessRuleException("Check-in is allowed on working days only.");
        }

        // 2. Resolve employee profile
        var employee = await _dbContext.Employees
            .Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.UserId == userId);

        if (employee == null)
        {
            throw new NotFoundException("Employee profile not found for the current user.");
        }

        if (employee.Status != EmployeeStatus.ACTIVE)
        {
            throw new ForbiddenException("Inactive employees cannot record attendance.");
        }

        // 3. One record per employee per day (BR-10, unique constraint + friendly 409)
        var existingAttendance = await _dbContext.Attendances
            .AnyAsync(a => a.EmployeeId == employee.Id && a.AttendanceDate == today);

        if (existingAttendance)
        {
            throw new ConflictException("You have already checked in for today.");
        }

        // 4. Determine status using configured late threshold (BR-11)
        var lateThreshold = AttendanceRuleEvaluator.ParseLateThreshold(_configuration["Attendance:LateAfter"]);
        var localTime = TimeOnly.FromDateTime(effectiveTime.Kind == DateTimeKind.Utc ? effectiveTime.ToLocalTime() : effectiveTime);
        var status = AttendanceRuleEvaluator.EvaluateCheckInStatus(localTime, lateThreshold);

        var attendance = new Attendance
        {
            EmployeeId = employee.Id,
            AttendanceDate = today,
            CheckIn = effectiveTime,
            CheckOut = null,
            Status = status,
            Notes = request?.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow
        };

        try
        {
            await _dbContext.Attendances.AddAsync(attendance);
            await _dbContext.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            _logger.LogWarning(ex, "Duplicate check-in race condition caught for employee ID {EmployeeId}", employee.Id);
            throw new ConflictException("You have already checked in for today.");
        }

        _logger.LogInformation("Employee {EmployeeCode} checked in at {Time} with status {Status}",
            employee.EmployeeCode, effectiveTime, status);

        attendance.Employee = employee;
        return MapToDto(attendance, today);
    }

    /// <summary>
    /// Records daily check-out for the current user's employee profile (FR-ATT-02, BR-12).
    /// </summary>
    public async Task<AttendanceDto> CheckOutAsync(long userId, CheckOutRequestDto? request = null, DateTime? checkOutTime = null)
    {
        var effectiveTime = checkOutTime ?? DateTime.UtcNow;
        var today = DateOnly.FromDateTime(effectiveTime);

        var employee = await _dbContext.Employees
            .Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.UserId == userId);

        if (employee == null)
        {
            throw new NotFoundException("Employee profile not found for the current user.");
        }

        // Must check in before checking out (FR-ATT-02)
        var attendance = await _dbContext.Attendances
            .Include(a => a.Employee)
            .ThenInclude(e => e.Department)
            .FirstOrDefaultAsync(a => a.EmployeeId == employee.Id && a.AttendanceDate == today);

        if (attendance == null)
        {
            throw new BusinessRuleException("You must check in before checking out.");
        }

        if (attendance.CheckOut.HasValue)
        {
            throw new ConflictException("You have already checked out for today.");
        }

        // Evaluate updated status (under 4 hours worked is HALF_DAY, BR-12)
        var finalStatus = AttendanceRuleEvaluator.EvaluateCheckOutStatus(attendance.CheckIn, effectiveTime, attendance.Status);

        attendance.CheckOut = effectiveTime;
        attendance.Status = finalStatus;

        if (!string.IsNullOrWhiteSpace(request?.Notes))
        {
            attendance.Notes = string.IsNullOrWhiteSpace(attendance.Notes)
                ? request.Notes.Trim()
                : $"{attendance.Notes} | {request.Notes.Trim()}";
        }

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Employee {EmployeeCode} checked out at {Time}. Final status: {Status}",
            employee.EmployeeCode, effectiveTime, finalStatus);

        return MapToDto(attendance, today);
    }

    /// <summary>
    /// Returns the current user's attendance state for today so the UI can render the correct buttons.
    /// </summary>
    public async Task<TodayAttendanceStateDto> GetMyTodayStateAsync(long userId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var isWorkingDay = AttendanceRuleEvaluator.IsWorkingDay(today);

        var employee = await _dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.UserId == userId);

        if (employee == null)
        {
            throw new NotFoundException("Employee profile not found for the current user.");
        }

        var attendance = await _dbContext.Attendances
            .AsNoTracking()
            .Include(a => a.Employee)
            .ThenInclude(e => e.Department)
            .FirstOrDefaultAsync(a => a.EmployeeId == employee.Id && a.AttendanceDate == today);

        if (attendance == null)
        {
            return new TodayAttendanceStateDto
            {
                State = "NOT_CHECKED_IN",
                Date = today,
                IsWorkingDay = isWorkingDay,
                CanCheckIn = isWorkingDay && employee.Status == EmployeeStatus.ACTIVE,
                CanCheckOut = false,
                Attendance = null
            };
        }

        if (!attendance.CheckOut.HasValue)
        {
            return new TodayAttendanceStateDto
            {
                State = "CHECKED_IN",
                Date = today,
                IsWorkingDay = isWorkingDay,
                CanCheckIn = false,
                CanCheckOut = true,
                Attendance = MapToDto(attendance, today)
            };
        }

        return new TodayAttendanceStateDto
        {
            State = "CHECKED_OUT",
            Date = today,
            IsWorkingDay = isWorkingDay,
            CanCheckIn = false,
            CanCheckOut = false,
            Attendance = MapToDto(attendance, today)
        };
    }

    /// <summary>
    /// Retrieves own attendance history for a given date range (FR-ATT-04).
    /// </summary>
    public async Task<IReadOnlyList<AttendanceDto>> GetMyAttendanceHistoryAsync(long userId, DateOnly? from, DateOnly? to)
    {
        var employee = await _dbContext.Employees.FirstOrDefaultAsync(e => e.UserId == userId);
        if (employee == null)
        {
            throw new NotFoundException("Employee profile not found for the current user.");
        }

        return await BuildAttendanceHistoryAsync(employee.Id, from, to);
    }

    /// <summary>
    /// Retrieves attendance history for a target employee (FR-ATT-05).
    /// Enforces access in the service: Admin sees any employee; Manager sees only own team.
    /// </summary>
    public async Task<IReadOnlyList<AttendanceDto>> GetEmployeeAttendanceHistoryAsync(long targetEmployeeId, DateOnly? from, DateOnly? to, CurrentUserContext currentUser)
    {
        var employee = await _dbContext.Employees
            .Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.Id == targetEmployeeId);

        if (employee == null)
        {
            throw new NotFoundException($"Employee with ID {targetEmployeeId} not found.");
        }

        // Scope check
        var role = currentUser.Role.ToUpperInvariant();
        if (role == "ADMIN")
        {
            // Allowed
        }
        else if (role == "MANAGER")
        {
            bool isSelf = currentUser.EmployeeId.HasValue && currentUser.EmployeeId.Value == employee.Id;
            if (!isSelf)
            {
                var managedDept = await _dbContext.Departments.FirstOrDefaultAsync(d => d.ManagerId == currentUser.EmployeeId);
                if (managedDept == null || employee.DepartmentId != managedDept.Id)
                {
                    throw new ForbiddenException("You do not have permission to view attendance for this employee.");
                }
            }
        }
        else if (role == "EMPLOYEE")
        {
            bool isSelf = currentUser.EmployeeId.HasValue && currentUser.EmployeeId.Value == employee.Id;
            if (!isSelf)
            {
                throw new ForbiddenException("You do not have permission to view attendance for this employee.");
            }
        }
        else
        {
            throw new ForbiddenException("You do not have permission to view attendance.");
        }

        return await BuildAttendanceHistoryAsync(employee.Id, from, to);
    }

    /// <summary>
    /// Today's attendance summary with counts and categorized employee lists (FR-ATT-06).
    /// Manager is scoped to their team; Admin sees the entire organization.
    /// </summary>
    public async Task<AttendanceSummaryDto> GetTodaySummaryAsync(CurrentUserContext currentUser, DateOnly? targetDate = null)
    {
        var today = targetDate ?? DateOnly.FromDateTime(DateTime.UtcNow);

        // Filter active employees based on role
        var empQuery = _dbContext.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .Where(e => e.Status == EmployeeStatus.ACTIVE);

        var role = currentUser.Role.ToUpperInvariant();
        if (role == "ADMIN")
        {
            // Organization-wide
        }
        else if (role == "MANAGER")
        {
            var managedDept = await _dbContext.Departments
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.ManagerId == currentUser.EmployeeId);

            if (managedDept != null)
            {
                empQuery = empQuery.Where(e => e.DepartmentId == managedDept.Id);
            }
            else
            {
                empQuery = empQuery.Where(e => e.Id == currentUser.EmployeeId);
            }
        }
        else
        {
            throw new ForbiddenException("You do not have permission to view the attendance summary.");
        }

        var activeEmployees = await empQuery.ToListAsync();
        var employeeIds = activeEmployees.Select(e => e.Id).ToList();

        // Fetch today's attendance records
        var attendances = await _dbContext.Attendances
            .AsNoTracking()
            .Include(a => a.Employee)
            .ThenInclude(e => e.Department)
            .Where(a => a.AttendanceDate == today && employeeIds.Contains(a.EmployeeId))
            .ToListAsync();

        var attendanceByEmpId = attendances.ToDictionary(a => a.EmployeeId, a => a);

        // Fetch approved leaves covering today
        var leavesToday = await _dbContext.LeaveRequests
            .AsNoTracking()
            .Include(lr => lr.LeaveType)
            .Include(lr => lr.Employee)
            .ThenInclude(e => e.Department)
            .Where(lr => lr.Status == LeaveStatus.APPROVED
                      && lr.StartDate <= today
                      && lr.EndDate >= today
                      && employeeIds.Contains(lr.EmployeeId))
            .ToListAsync();

        var leaveByEmpId = leavesToday.ToDictionary(lr => lr.EmployeeId, lr => lr);

        var summary = new AttendanceSummaryDto
        {
            Date = today,
            TotalEmployees = activeEmployees.Count
        };

        foreach (var emp in activeEmployees)
        {
            if (attendanceByEmpId.TryGetValue(emp.Id, out var att))
            {
                var item = new AttendanceItemDto
                {
                    EmployeeId = emp.Id,
                    EmployeeCode = emp.EmployeeCode,
                    FullName = emp.FullName,
                    DepartmentName = emp.Department?.Name ?? string.Empty,
                    CheckIn = att.CheckIn,
                    CheckOut = att.CheckOut,
                    Status = att.Status.ToString(),
                    WorkedHours = AttendanceRuleEvaluator.CalculateWorkedHours(att.CheckIn, att.CheckOut)
                };

                if (att.Status == AttendanceStatus.LATE)
                {
                    summary.LateCount++;
                    summary.LateEmployees.Add(item);
                }
                else if (att.Status == AttendanceStatus.HALF_DAY)
                {
                    summary.HalfDayCount++;
                }

                summary.PresentCount++;
                summary.PresentEmployees.Add(item);
            }
            else if (leaveByEmpId.TryGetValue(emp.Id, out var leave))
            {
                summary.OnLeaveCount++;
                summary.OnLeaveEmployees.Add(new OnLeaveItemDto
                {
                    EmployeeId = emp.Id,
                    EmployeeCode = emp.EmployeeCode,
                    FullName = emp.FullName,
                    DepartmentName = emp.Department?.Name ?? string.Empty,
                    LeaveType = leave.LeaveType?.Name ?? "Leave",
                    StartDate = leave.StartDate,
                    EndDate = leave.EndDate
                });
            }
            else
            {
                // Working day with no record and no approved leave is ABSENT (BR-13)
                summary.AbsentCount++;
                summary.AbsentEmployees.Add(new AbsentItemDto
                {
                    EmployeeId = emp.Id,
                    EmployeeCode = emp.EmployeeCode,
                    FullName = emp.FullName,
                    DepartmentName = emp.Department?.Name ?? string.Empty
                });
            }
        }

        return summary;
    }

    /// <summary>
    /// Builds attendance history for an employee over a date range.
    /// Incorporates BR-13 (reports ABSENT on working days with no check-in and no approved leave)
    /// and BR-14 (flags records without check-out after the day has ended).
    /// </summary>
    private async Task<IReadOnlyList<AttendanceDto>> BuildAttendanceHistoryAsync(long employeeId, DateOnly? from, DateOnly? to)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var toDate = to ?? today;
        var fromDate = from ?? toDate.AddDays(-30);

        if (fromDate > toDate)
        {
            throw new BusinessRuleException("'from' date cannot be after 'to' date.");
        }

        var employee = await _dbContext.Employees
            .AsNoTracking()
            .Include(e => e.Department)
            .FirstOrDefaultAsync(e => e.Id == employeeId);

        if (employee == null)
        {
            throw new NotFoundException($"Employee with ID {employeeId} not found.");
        }

        // 1. Fetch attendance records in date range
        var attendances = await _dbContext.Attendances
            .AsNoTracking()
            .Where(a => a.EmployeeId == employeeId && a.AttendanceDate >= fromDate && a.AttendanceDate <= toDate)
            .ToListAsync();

        var attendanceDict = attendances.ToDictionary(a => a.AttendanceDate, a => a);

        // 2. Fetch approved leaves in date range
        var approvedLeaves = await _dbContext.LeaveRequests
            .AsNoTracking()
            .Include(lr => lr.LeaveType)
            .Where(lr => lr.EmployeeId == employeeId
                      && lr.Status == LeaveStatus.APPROVED
                      && lr.StartDate <= toDate
                      && lr.EndDate >= fromDate)
            .ToListAsync();

        var result = new List<AttendanceDto>();

        // 3. Iterate each calendar date from toDate down to fromDate
        for (var current = toDate; current >= fromDate; current = current.AddDays(-1))
        {
            if (attendanceDict.TryGetValue(current, out var att))
            {
                result.Add(new AttendanceDto
                {
                    Id = att.Id,
                    EmployeeId = employee.Id,
                    EmployeeName = employee.FullName,
                    EmployeeCode = employee.EmployeeCode,
                    DepartmentName = employee.Department?.Name ?? string.Empty,
                    AttendanceDate = att.AttendanceDate,
                    CheckIn = att.CheckIn,
                    CheckOut = att.CheckOut,
                    Status = att.Status.ToString(),
                    Notes = att.Notes,
                    WorkedHours = AttendanceRuleEvaluator.CalculateWorkedHours(att.CheckIn, att.CheckOut),
                    HasMissingCheckOut = AttendanceRuleEvaluator.IsMissedCheckOut(att.AttendanceDate, att.CheckOut, today)
                });
            }
            else if (AttendanceRuleEvaluator.IsWorkingDay(current) && current <= today && current >= employee.JoinedDate)
            {
                // Check if covered by approved leave
                var leave = approvedLeaves.FirstOrDefault(lr => lr.StartDate <= current && lr.EndDate >= current);
                if (leave != null)
                {
                    result.Add(new AttendanceDto
                    {
                        Id = 0,
                        EmployeeId = employee.Id,
                        EmployeeName = employee.FullName,
                        EmployeeCode = employee.EmployeeCode,
                        DepartmentName = employee.Department?.Name ?? string.Empty,
                        AttendanceDate = current,
                        CheckIn = null,
                        CheckOut = null,
                        Status = "ON_LEAVE",
                        Notes = $"Approved Leave: {leave.LeaveType?.Name ?? "Leave"}",
                        WorkedHours = null,
                        HasMissingCheckOut = false
                    });
                }
                else
                {
                    // Working day with no check-in and no approved leave is reported as ABSENT (BR-13)
                    result.Add(new AttendanceDto
                    {
                        Id = 0,
                        EmployeeId = employee.Id,
                        EmployeeName = employee.FullName,
                        EmployeeCode = employee.EmployeeCode,
                        DepartmentName = employee.Department?.Name ?? string.Empty,
                        AttendanceDate = current,
                        CheckIn = null,
                        CheckOut = null,
                        Status = AttendanceStatus.ABSENT.ToString(),
                        Notes = "No attendance recorded",
                        WorkedHours = null,
                        HasMissingCheckOut = false
                    });
                }
            }
        }

        return result;
    }

    private static AttendanceDto MapToDto(Attendance a, DateOnly today)
    {
        return new AttendanceDto
        {
            Id = a.Id,
            EmployeeId = a.EmployeeId,
            EmployeeName = a.Employee != null ? $"{a.Employee.FirstName} {a.Employee.LastName}" : string.Empty,
            EmployeeCode = a.Employee?.EmployeeCode ?? string.Empty,
            DepartmentName = a.Employee?.Department?.Name ?? string.Empty,
            AttendanceDate = a.AttendanceDate,
            CheckIn = a.CheckIn,
            CheckOut = a.CheckOut,
            Status = a.Status.ToString(),
            Notes = a.Notes,
            WorkedHours = AttendanceRuleEvaluator.CalculateWorkedHours(a.CheckIn, a.CheckOut),
            HasMissingCheckOut = AttendanceRuleEvaluator.IsMissedCheckOut(a.AttendanceDate, a.CheckOut, today)
        };
    }
}
