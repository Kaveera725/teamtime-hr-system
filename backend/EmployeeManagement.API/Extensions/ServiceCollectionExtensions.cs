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

        // Additional services will be registered as implemented in subsequent tasks:
        // services.AddScoped<IEmployeeService, EmployeeService>();
        // services.AddScoped<IAttendanceService, AttendanceService>();
        // services.AddScoped<ILeaveService, LeaveService>();

        return services;
    }
}
