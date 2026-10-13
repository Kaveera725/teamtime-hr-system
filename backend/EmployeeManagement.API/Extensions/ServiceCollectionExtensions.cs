namespace EmployeeManagement.API.Extensions;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Registers all application business services, handlers, and repositories
    /// following a consistent scoped dependency injection pattern.
    /// </summary>
    public static IServiceCollection AddApplicationServices(this IServiceCollection services, IConfiguration configuration)
    {
        // Application services will be registered here as implemented in subsequent tasks:
        // services.AddScoped<IAuthService, AuthService>();
        // services.AddScoped<IEmployeeService, EmployeeService>();
        // services.AddScoped<IAttendanceService, AttendanceService>();
        // services.AddScoped<ILeaveService, LeaveService>();

        return services;
    }
}
