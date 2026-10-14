using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Dashboard;

namespace EmployeeManagement.API.Interfaces;

public interface IDashboardService
{
    /// <summary>
    /// Returns the role-specific dashboard payload based on the user's role (Section 3.6).
    /// </summary>
    Task<object> GetDashboardAsync(CurrentUserContext userContext);

    /// <summary>
    /// Returns the employee dashboard (FR-DSH-01).
    /// </summary>
    Task<EmployeeDashboardDto> GetEmployeeDashboardAsync(long userId);

    /// <summary>
    /// Returns the manager dashboard (FR-DSH-02).
    /// </summary>
    Task<ManagerDashboardDto> GetManagerDashboardAsync(CurrentUserContext userContext);

    /// <summary>
    /// Returns the admin dashboard (FR-DSH-03).
    /// </summary>
    Task<AdminDashboardDto> GetAdminDashboardAsync(CurrentUserContext userContext);
}
