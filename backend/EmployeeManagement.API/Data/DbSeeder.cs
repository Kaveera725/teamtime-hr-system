using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace EmployeeManagement.API.Data;

public static class DbSeeder
{
    /// <summary>
    /// Seeds the first administrator account on application startup if no admin exists (Section 7.10, 9).
    /// </summary>
    public static async Task SeedAdminAsync(IServiceProvider serviceProvider, IConfiguration configuration)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Check if an admin user already exists
        var hasAdmin = await context.Users.AnyAsync(u => u.Role == UserRole.ADMIN);
        if (hasAdmin)
        {
            return;
        }

        var adminEmail = configuration["Seed:AdminEmail"]
            ?? configuration["Seed__AdminEmail"]
            ?? "admin@company.com";

        var adminPassword = configuration["Seed:AdminPassword"]
            ?? configuration["Seed__AdminPassword"]
            ?? "Admin@123456ChangeMe!";

        var itDepartment = await context.Departments.FirstOrDefaultAsync(d => d.Name == "IT")
            ?? await context.Departments.FirstOrDefaultAsync();

        if (itDepartment == null)
        {
            Log.Warning("Cannot seed admin user: No departments exist in database.");
            return;
        }

        var adminUser = new User
        {
            Email = adminEmail.Trim().ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword),
            Role = UserRole.ADMIN,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var adminEmployee = new Employee
        {
            User = adminUser,
            EmployeeCode = "EMP-0001",
            FirstName = "System",
            LastName = "Administrator",
            DepartmentId = itDepartment.Id,
            Position = "System Administrator",
            JoinedDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = EmployeeStatus.ACTIVE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await context.Users.AddAsync(adminUser);
        await context.Employees.AddAsync(adminEmployee);
        await context.SaveChangesAsync();

        // Seed leave balances for admin employee for the current year
        var currentYear = DateTime.UtcNow.Year;
        var activeLeaveTypes = await context.LeaveTypes.Where(lt => lt.IsActive).ToListAsync();

        foreach (var lt in activeLeaveTypes)
        {
            context.LeaveBalances.Add(new LeaveBalance
            {
                EmployeeId = adminEmployee.Id,
                LeaveTypeId = lt.Id,
                Year = currentYear,
                AllocatedDays = lt.DefaultDays,
                UsedDays = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        await context.SaveChangesAsync();
        Log.Information("Initial administrator user seeded: {AdminEmail}", adminEmail);
    }
}
