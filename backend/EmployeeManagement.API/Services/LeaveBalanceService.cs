using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Leave;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;

namespace EmployeeManagement.API.Services;

/// <summary>
/// Service managing employee leave allocations, balances, usage calculations, and approval helpers
/// (Sections 3.5, 7.8, 8.5, FR-LEV-09, BR-04, BR-05, BR-06, BR-15).
/// </summary>
public class LeaveBalanceService : ILeaveBalanceService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<LeaveBalanceService> _logger;

    public LeaveBalanceService(ApplicationDbContext dbContext, ILogger<LeaveBalanceService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Creates leave balances for an employee for a specific year for all active leave types (FR-LEV-09).
    /// Idempotent: checks for existing balances to prevent duplicate records (BR-15).
    /// </summary>
    public async Task<IReadOnlyList<LeaveBalanceDto>> CreateBalancesForEmployeeAsync(long employeeId, int year)
    {
        var employee = await _dbContext.Employees.FindAsync(employeeId);
        if (employee == null)
        {
            throw new NotFoundException($"Employee with ID {employeeId} not found.");
        }

        var activeLeaveTypes = await _dbContext.LeaveTypes
            .Where(lt => lt.IsActive)
            .ToListAsync();

        var existingLeaveTypeIds = await _dbContext.LeaveBalances
            .Where(lb => lb.EmployeeId == employeeId && lb.Year == year)
            .Select(lb => lb.LeaveTypeId)
            .ToListAsync();

        var newBalances = new List<LeaveBalance>();
        foreach (var lt in activeLeaveTypes)
        {
            if (!existingLeaveTypeIds.Contains(lt.Id))
            {
                newBalances.Add(new LeaveBalance
                {
                    EmployeeId = employeeId,
                    LeaveTypeId = lt.Id,
                    Year = year,
                    AllocatedDays = lt.DefaultDays,
                    UsedDays = 0,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                });
            }
        }

        if (newBalances.Count > 0)
        {
            await _dbContext.LeaveBalances.AddRangeAsync(newBalances);
            await _dbContext.SaveChangesAsync();
            _logger.LogInformation("Created {Count} leave balances for Employee ID {EmployeeId} for year {Year}",
                newBalances.Count, employeeId, year);
        }

        return await GetEmployeeBalancesAsync(employeeId, year);
    }

    /// <summary>
    /// Retrieves leave balances for the currently authenticated employee for a specified year (FR-LEV-03, Section 8.5).
    /// If year is not specified, defaults to the current calendar year.
    /// Calculates allocated, used, pending requests, and remaining days.
    /// </summary>
    public async Task<IReadOnlyList<LeaveBalanceDto>> GetMyBalancesAsync(long userId, int? year)
    {
        var targetYear = year ?? DateTime.UtcNow.Year;

        var employee = await _dbContext.Employees
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.UserId == userId);

        if (employee == null)
        {
            throw new NotFoundException("Employee profile not found for the current user.");
        }

        return await GetEmployeeBalancesAsync(employee.Id, targetYear);
    }

    /// <summary>
    /// Retrieves leave balances for a specific employee and year, including pending days from pending requests (BR-04).
    /// </summary>
    public async Task<IReadOnlyList<LeaveBalanceDto>> GetEmployeeBalancesAsync(long employeeId, int year)
    {
        // 1. Fetch balances with leave type information
        var balances = await _dbContext.LeaveBalances
            .AsNoTracking()
            .Include(lb => lb.LeaveType)
            .Where(lb => lb.EmployeeId == employeeId && lb.Year == year)
            .OrderBy(lb => lb.LeaveType.Name)
            .ToListAsync();

        // 2. Compute pending days from pending leave requests in the specified year (BR-04)
        var pendingRequests = await _dbContext.LeaveRequests
            .AsNoTracking()
            .Where(lr => lr.EmployeeId == employeeId
                      && lr.Status == LeaveStatus.PENDING
                      && lr.StartDate.Year == year)
            .GroupBy(lr => lr.LeaveTypeId)
            .Select(g => new { LeaveTypeId = g.Key, PendingDays = g.Sum(lr => lr.TotalDays) })
            .ToDictionaryAsync(x => x.LeaveTypeId, x => x.PendingDays);

        return balances.Select(b => new LeaveBalanceDto
        {
            Id = b.Id,
            LeaveTypeId = b.LeaveTypeId,
            LeaveTypeName = b.LeaveType?.Name ?? string.Empty,
            Year = b.Year,
            AllocatedDays = b.AllocatedDays,
            UsedDays = b.UsedDays,
            PendingDays = pendingRequests.GetValueOrDefault(b.LeaveTypeId, 0m)
        }).ToList();
    }

    /// <summary>
    /// Generates next year's leave balances for all active employees for all active leave types (BR-15).
    /// Admin endpoint: strictly idempotency-safe to run multiple times without creating duplicates.
    /// No carry-forward is applied per BR-15.
    /// </summary>
    public async Task<GenerateLeaveBalancesResultDto> GenerateYearlyBalancesAsync(int? year)
    {
        var targetYear = year ?? (DateTime.UtcNow.Year + 1);

        var activeEmployees = await _dbContext.Employees
            .Where(e => e.Status == EmployeeStatus.ACTIVE)
            .ToListAsync();

        var activeLeaveTypes = await _dbContext.LeaveTypes
            .Where(lt => lt.IsActive)
            .ToListAsync();

        // Fetch existing balances for this year to guarantee idempotency and avoid duplicates
        var existingPairs = await _dbContext.LeaveBalances
            .Where(lb => lb.Year == targetYear)
            .Select(lb => new { lb.EmployeeId, lb.LeaveTypeId })
            .ToListAsync();

        var existingLookup = new HashSet<(long empId, long ltId)>(
            existingPairs.Select(p => (p.EmployeeId, p.LeaveTypeId)));

        var balancesToAdd = new List<LeaveBalance>();
        int skippedCount = 0;

        foreach (var emp in activeEmployees)
        {
            foreach (var lt in activeLeaveTypes)
            {
                if (existingLookup.Contains((emp.Id, lt.Id)))
                {
                    skippedCount++;
                }
                else
                {
                    balancesToAdd.Add(new LeaveBalance
                    {
                        EmployeeId = emp.Id,
                        LeaveTypeId = lt.Id,
                        Year = targetYear,
                        AllocatedDays = lt.DefaultDays,
                        UsedDays = 0,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    });
                }
            }
        }

        if (balancesToAdd.Count > 0)
        {
            await _dbContext.LeaveBalances.AddRangeAsync(balancesToAdd);
            await _dbContext.SaveChangesAsync();
        }

        _logger.LogInformation("Yearly leave balance generation completed for Year {Year}: Created {Created}, Skipped {Skipped}",
            targetYear, balancesToAdd.Count, skippedCount);

        return new GenerateLeaveBalancesResultDto
        {
            Year = targetYear,
            ActiveEmployeesCount = activeEmployees.Count,
            ActiveLeaveTypesCount = activeLeaveTypes.Count,
            BalancesCreatedCount = balancesToAdd.Count,
            BalancesSkippedCount = skippedCount,
            Message = $"Generated {balancesToAdd.Count} leave balances for year {targetYear}. {skippedCount} existing balances skipped."
        };
    }

    /// <summary>
    /// Helper used by leave approval workflow to deduct approved leave days from used days (BR-05, BR-07).
    /// </summary>
    public async Task DeductLeaveBalanceAsync(long employeeId, long leaveTypeId, int year, decimal days)
    {
        var balance = await _dbContext.LeaveBalances
            .Include(lb => lb.LeaveType)
            .FirstOrDefaultAsync(lb => lb.EmployeeId == employeeId && lb.LeaveTypeId == leaveTypeId && lb.Year == year);

        if (balance == null)
        {
            throw new NotFoundException($"Leave balance not found for employee ID {employeeId}, leave type ID {leaveTypeId}, year {year}.");
        }

        // Validate balance sufficiency (No Pay Leave is exempt from balance check per BR-04)
        if (!string.Equals(balance.LeaveType?.Name, "No Pay Leave", StringComparison.OrdinalIgnoreCase))
        {
            if (balance.UsedDays + days > balance.AllocatedDays)
            {
                throw new BusinessRuleException(
                    $"Insufficient leave balance. Remaining: {balance.RemainingDays} days, Requested deduction: {days} days.");
            }
        }

        balance.UsedDays += days;
        balance.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Deducted {Days} days from Employee ID {EmployeeId} (LeaveType {LeaveTypeId}, Year {Year}). New used: {UsedDays}",
            days, employeeId, leaveTypeId, year, balance.UsedDays);
    }

    /// <summary>
    /// Helper used by leave cancellation workflow to restore days to balance (BR-06).
    /// </summary>
    public async Task RestoreLeaveBalanceAsync(long employeeId, long leaveTypeId, int year, decimal days)
    {
        var balance = await _dbContext.LeaveBalances
            .FirstOrDefaultAsync(lb => lb.EmployeeId == employeeId && lb.LeaveTypeId == leaveTypeId && lb.Year == year);

        if (balance == null)
        {
            throw new NotFoundException($"Leave balance not found for employee ID {employeeId}, leave type ID {leaveTypeId}, year {year}.");
        }

        balance.UsedDays = Math.Max(0, balance.UsedDays - days);
        balance.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Restored {Days} days to Employee ID {EmployeeId} (LeaveType {LeaveTypeId}, Year {Year}). New used: {UsedDays}",
            days, employeeId, leaveTypeId, year, balance.UsedDays);
    }
}
