using EmployeeManagement.API.DTOs.Leave;

namespace EmployeeManagement.API.Interfaces;

public interface ILeaveBalanceService
{
    Task<IReadOnlyList<LeaveBalanceDto>> CreateBalancesForEmployeeAsync(long employeeId, int year);
    Task<IReadOnlyList<LeaveBalanceDto>> GetMyBalancesAsync(long userId, int? year);
    Task<IReadOnlyList<LeaveBalanceDto>> GetEmployeeBalancesAsync(long employeeId, int year);
    Task<GenerateLeaveBalancesResultDto> GenerateYearlyBalancesAsync(int? year);
    Task DeductLeaveBalanceAsync(long employeeId, long leaveTypeId, int year, decimal days);
    Task RestoreLeaveBalanceAsync(long employeeId, long leaveTypeId, int year, decimal days);
}
