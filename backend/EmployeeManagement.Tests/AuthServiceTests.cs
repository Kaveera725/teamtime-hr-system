using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Auth;
using EmployeeManagement.API.DTOs.User;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Models;
using EmployeeManagement.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Xunit;

namespace EmployeeManagement.Tests;

public class AuthServiceTests
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthServiceTests()
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            {"Jwt:Key", "super_secret_jwt_key_that_is_at_least_32_characters_long_for_security"},
            {"Jwt:Issuer", "EmployeeManagementAPI"},
            {"Jwt:Audience", "EmployeeManagementWeb"},
            {"Jwt:ExpiryMinutes", "60"}
        };

        _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        _logger = loggerFactory.CreateLogger<AuthService>();
    }

    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task FR_AUTH_01_Login_With_Valid_Credentials_Returns_Token_And_User()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var department = new Department { Name = "IT" };
        context.Departments.Add(department);
        await context.SaveChangesAsync();

        var password = "StrongPassword@123";
        var user = new User
        {
            Email = "john.doe@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = UserRole.EMPLOYEE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var employee = new Employee
        {
            User = user,
            EmployeeCode = "EMP-0010",
            FirstName = "John",
            LastName = "Doe",
            DepartmentId = department.Id,
            Position = "Software Engineer",
            JoinedDate = new DateOnly(2026, 1, 1),
            Status = EmployeeStatus.ACTIVE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Users.Add(user);
        context.Employees.Add(employee);
        await context.SaveChangesAsync();

        var service = new AuthService(context, _configuration, _logger);

        // Act
        var result = await service.LoginAsync(new LoginRequestDto
        {
            Email = "john.doe@company.com",
            Password = password
        });

        // Assert
        Assert.NotNull(result);
        Assert.False(string.IsNullOrWhiteSpace(result.Token));
        Assert.Equal("john.doe@company.com", result.User.Email);
        Assert.Equal("EMPLOYEE", result.User.Role);
        Assert.Equal("John Doe", result.User.FullName);
    }

    [Fact]
    public async Task FR_AUTH_01_Login_With_Invalid_Password_Throws_BusinessRuleException()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var user = new User
        {
            Email = "test@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("CorrectPassword@123"),
            Role = UserRole.EMPLOYEE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new AuthService(context, _configuration, _logger);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.LoginAsync(new LoginRequestDto
            {
                Email = "test@company.com",
                Password = "WrongPassword@123"
            }));

        Assert.Equal("Invalid email or password.", ex.Message);
    }

    [Fact]
    public async Task FR_AUTH_05_Login_With_Inactive_Employee_Throws_UnauthorizedException()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var department = new Department { Name = "HR" };
        context.Departments.Add(department);
        await context.SaveChangesAsync();

        var password = "ValidPassword@123";
        var user = new User
        {
            Email = "inactive@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = UserRole.EMPLOYEE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var employee = new Employee
        {
            User = user,
            EmployeeCode = "EMP-0099",
            FirstName = "Inactive",
            LastName = "User",
            DepartmentId = department.Id,
            Position = "HR Specialist",
            JoinedDate = new DateOnly(2026, 1, 1),
            Status = EmployeeStatus.INACTIVE, // Deactivated
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Users.Add(user);
        context.Employees.Add(employee);
        await context.SaveChangesAsync();

        var service = new AuthService(context, _configuration, _logger);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<UnauthorizedException>(() =>
            service.LoginAsync(new LoginRequestDto
            {
                Email = "inactive@company.com",
                Password = password
            }));

        Assert.Contains("deactivated", ex.Message);
    }

    [Fact]
    public async Task FR_AUTH_03_GetCurrentUserProfile_Returns_Required_UI_Fields()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var department = new Department { Name = "Finance" };
        context.Departments.Add(department);
        await context.SaveChangesAsync();

        var user = new User
        {
            Email = "jane.smith@company.com",
            PasswordHash = "hash",
            Role = UserRole.MANAGER,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        var employee = new Employee
        {
            User = user,
            EmployeeCode = "EMP-0005",
            FirstName = "Jane",
            LastName = "Smith",
            DepartmentId = department.Id,
            Position = "Finance Lead",
            JoinedDate = new DateOnly(2026, 2, 1),
            Status = EmployeeStatus.ACTIVE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Users.Add(user);
        context.Employees.Add(employee);
        await context.SaveChangesAsync();

        var service = new AuthService(context, _configuration, _logger);

        // Act
        var profile = await service.GetCurrentUserProfileAsync(user.Id);

        // Assert
        Assert.Equal(user.Id, profile.UserId);
        Assert.Equal("jane.smith@company.com", profile.Email);
        Assert.Equal("MANAGER", profile.Role);
        Assert.Equal(employee.Id, profile.EmployeeId);
        Assert.Equal("EMP-0005", profile.EmployeeCode);
        Assert.Equal("Jane Smith", profile.FullName);
        Assert.Equal("Finance", profile.DepartmentName);
        Assert.Equal("Finance Lead", profile.Position);
    }

    [Fact]
    public async Task FR_AUTH_04_ChangePassword_With_Valid_New_Password_Succeeds()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var currentPassword = "CurrentPassword@123";
        var user = new User
        {
            Email = "change.pw@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(currentPassword),
            Role = UserRole.EMPLOYEE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new AuthService(context, _configuration, _logger);
        var newPassword = "NewStrongPassword@456";

        // Act
        await service.ChangePasswordAsync(user.Id, new ChangePasswordRequestDto
        {
            CurrentPassword = currentPassword,
            NewPassword = newPassword
        });

        // Assert
        var updatedUser = await context.Users.FindAsync(user.Id);
        Assert.NotNull(updatedUser);
        Assert.True(BCrypt.Net.BCrypt.Verify(newPassword, updatedUser.PasswordHash));
    }

    [Fact]
    public async Task FR_AUTH_04_ChangePassword_With_Invalid_Current_Password_Throws_BusinessRuleException()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var user = new User
        {
            Email = "wrong.current@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("ActualPassword@123"),
            Role = UserRole.EMPLOYEE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new AuthService(context, _configuration, _logger);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.ChangePasswordAsync(user.Id, new ChangePasswordRequestDto
            {
                CurrentPassword = "IncorrectCurrentPassword@123",
                NewPassword = "NewPassword@999"
            }));

        Assert.Equal("Current password is incorrect.", ex.Message);
    }

    [Fact]
    public async Task FR_AUTH_04_ChangePassword_With_Weak_Password_Throws_BusinessRuleException()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var currentPassword = "GoodPassword@123";
        var user = new User
        {
            Email = "weak.pw@company.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(currentPassword),
            Role = UserRole.EMPLOYEE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new AuthService(context, _configuration, _logger);

        // Act & Assert (missing special character and number)
        var ex = await Assert.ThrowsAsync<BusinessRuleException>(() =>
            service.ChangePasswordAsync(user.Id, new ChangePasswordRequestDto
            {
                CurrentPassword = currentPassword,
                NewPassword = "alllowercaseonly"
            }));

        Assert.Contains("uppercase", ex.Message);
    }

    [Fact]
    public async Task FR_AUTH_02_CreateUser_With_Duplicate_Email_Throws_ConflictException()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var department = new Department { Name = "Marketing" };
        context.Departments.Add(department);
        var existingUser = new User
        {
            Email = "duplicate@company.com",
            PasswordHash = "hash",
            Role = UserRole.EMPLOYEE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        context.Users.Add(existingUser);
        await context.SaveChangesAsync();

        var service = new AuthService(context, _configuration, _logger);

        // Act & Assert
        await Assert.ThrowsAsync<ConflictException>(() =>
            service.CreateUserAsync(new CreateUserRequestDto
            {
                Email = "duplicate@company.com",
                Password = "Password@123",
                Role = UserRole.EMPLOYEE,
                FirstName = "Dup",
                LastName = "User",
                DepartmentId = department.Id,
                Position = "Specialist"
            }));
    }

    [Fact]
    public async Task FR_AUTH_02_CreateUser_Success_Seeds_LeaveBalances()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var department = new Department { Name = "IT" };
        context.Departments.Add(department);
        var annualLeave = new LeaveType { Name = "Annual Leave", DefaultDays = 14, IsActive = true };
        var casualLeave = new LeaveType { Name = "Casual Leave", DefaultDays = 7, IsActive = true };
        context.LeaveTypes.AddRange(annualLeave, casualLeave);
        await context.SaveChangesAsync();

        var service = new AuthService(context, _configuration, _logger);

        // Act
        var result = await service.CreateUserAsync(new CreateUserRequestDto
        {
            Email = "new.employee@company.com",
            Password = "SecurePassword@123",
            Role = UserRole.EMPLOYEE,
            FirstName = "Alice",
            LastName = "Wonderland",
            DepartmentId = department.Id,
            Position = "Junior Dev"
        });

        // Assert
        Assert.NotNull(result);
        Assert.Equal("new.employee@company.com", result.Email);
        Assert.NotNull(result.EmployeeId);

        var balances = await context.LeaveBalances.Where(lb => lb.EmployeeId == result.EmployeeId).ToListAsync();
        Assert.Equal(2, balances.Count);
        Assert.Contains(balances, b => b.AllocatedDays == 14);
        Assert.Contains(balances, b => b.AllocatedDays == 7);
    }
}
