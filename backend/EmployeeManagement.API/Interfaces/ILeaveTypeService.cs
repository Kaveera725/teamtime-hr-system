using EmployeeManagement.API.DTOs.Leave;

namespace EmployeeManagement.API.Interfaces;

public interface ILeaveTypeService
{
    Task<IReadOnlyList<LeaveTypeDto>> GetLeaveTypesAsync(bool includeInactive = false);
    Task<LeaveTypeDto> GetLeaveTypeByIdAsync(long id);
    Task<LeaveTypeDto> CreateLeaveTypeAsync(CreateLeaveTypeRequestDto request);
    Task<LeaveTypeDto> UpdateLeaveTypeAsync(long id, UpdateLeaveTypeRequestDto request);
    Task<LeaveTypeDto> DeactivateLeaveTypeAsync(long id);
}
