using EmployeeManagement.API.Interfaces;
using EmployeeManagement.API.Services;

namespace EmployeeManagement.API.Extensions;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers all application business services, handlers, and repositories
    /// following a consistent scoped dependency injection pattern.
    /// </summary>
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
    {
        // Authentication & User management service
        services.AddScoped<IAuthService, AuthService>();

        // Department & Employee services (Sections 3.2, 3.3, 8.2, 8.3)
        services.AddScoped<IDepartmentService, DepartmentService>();
        services.AddScoped<IEmployeeService, EmployeeService>();

        // Leave type & Leave balance services (Sections 3.5, 7.6, 7.8, 8.5, FR-LEV-08, FR-LEV-09, BR-15)
        services.AddScoped<ILeaveTypeService, LeaveTypeService>();
        services.AddScoped<ILeaveBalanceService, LeaveBalanceService>();

        // Additional services will be registered as implemented in subsequent tasks:
        // services.AddScoped<IAttendanceService, AttendanceService>();
        // services.AddScoped<ILeaveService, LeaveService>();

        return services;
    }
}
