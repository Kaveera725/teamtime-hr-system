using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Leave;
using EmployeeManagement.API.Models;

namespace EmployeeManagement.API.Interfaces;

public interface ILeaveService
{
    /// <summary>
    /// Submits a leave request following validation sequence 5.2 (BR-01 to BR-09).
    /// </summary>
    Task<LeaveRequestDto> CreateAsync(long userId, CreateLeaveRequestDto request);

    /// <summary>
    /// Calculates preview metrics (working days, balance after, rule validation errors) without persisting.
    /// </summary>
    Task<LeaveRequestPreviewResponseDto> PreviewAsync(long userId, LeaveRequestPreviewRequestDto request);

    /// <summary>
    /// Gets the current authenticated employee's leave requests with optional filters and pagination.
    /// </summary>
    Task<PagedResult<LeaveRequestDto>> GetMyRequestsAsync(long userId, LeaveStatus? status, int? year, int page = 1, int pageSize = 20);

    /// <summary>
    /// Retrieves leave requests with filtering and pagination. Manager is scoped to team; Admin sees all.
    /// </summary>
    Task<PagedResult<LeaveRequestDto>> GetRequestsAsync(CurrentUserContext userContext, LeaveRequestQueryParameters query);

    /// <summary>
    /// Retrieves a single leave request by ID with access control (Owner, Team Manager, Admin).
    /// </summary>
    Task<LeaveRequestDto> GetByIdAsync(long id, CurrentUserContext userContext);

    /// <summary>
    /// Approves a pending leave request, deducting balance in the same transaction (BR-05, BR-07, xmin concurrency token).
    /// </summary>
    Task<LeaveRequestDto> ApproveAsync(long id, CurrentUserContext userContext);

    /// <summary>
    /// Rejects a pending leave request with a mandatory rejection reason (BR-07, Section 5.1).
    /// </summary>
    Task<LeaveRequestDto> RejectAsync(long id, CurrentUserContext userContext, RejectLeaveRequestDto dto);

    /// <summary>
    /// Cancels a leave request (Owner only; PENDING or APPROVED before start date per BR-06).
    /// Restores balance if request was previously approved.
    /// </summary>
    Task<LeaveRequestDto> CancelAsync(long id, CurrentUserContext userContext);
}
