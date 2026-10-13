using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Department;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Models;
using EmployeeManagement.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Xunit;

namespace EmployeeManagement.Tests;

public class DepartmentServiceTests
{
    private readonly ILogger<DepartmentService> _logger;

    public DepartmentServiceTests()
    {
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        _logger = loggerFactory.CreateLogger<DepartmentService>();
    }

    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task GetAllDepartments_Returns_List_With_Manager_And_EmployeeCount()
    {
        using var context = CreateInMemoryDbContext();
        var dept = new Department { Name = "Engineering", Description = "Tech team" };
        context.Departments.Add(dept);
        await context.SaveChangesAsync();

        var user = new User { Email = "manager@company.com", PasswordHash = "hash", Role = UserRole.MANAGER };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var manager = new Employee
        {
            UserId = user.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "EMP001",
            FirstName = "Alice",
            LastName = "Smith",
            Position = "Engineering Lead",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.Add(manager);
        await context.SaveChangesAsync();

        dept.ManagerId = manager.Id;
        await context.SaveChangesAsync();

        var service = new DepartmentService(context, _logger);
        var result = await service.GetAllDepartmentsAsync();

        Assert.Single(result);
        Assert.Equal("Engineering", result[0].Name);
        Assert.Equal("Alice Smith", result[0].ManagerName);
        Assert.Equal(manager.Id, result[0].ManagerId);
        Assert.Equal(1, result[0].EmployeeCount);
    }

    [Fact]
    public async Task CreateDepartment_Valid_Returns_Created_Department()
    {
        using var context = CreateInMemoryDbContext();
        var service = new DepartmentService(context, _logger);

        var request = new CreateDepartmentRequestDto
        {
            Name = "Human Resources",
            Description = "HR team"
        };

        var result = await service.CreateDepartmentAsync(request);

        Assert.True(result.Id > 0);
        Assert.Equal("Human Resources", result.Name);
        Assert.Equal("HR team", result.Description);
        Assert.Null(result.ManagerId);
        Assert.Equal(0, result.EmployeeCount);
    }

    [Fact]
    public async Task CreateDepartment_Duplicate_Name_Throws_ConflictException()
    {
        using var context = CreateInMemoryDbContext();
        context.Departments.Add(new Department { Name = "Finance" });
        await context.SaveChangesAsync();

        var service = new DepartmentService(context, _logger);
        var request = new CreateDepartmentRequestDto { Name = "finance" };

        await Assert.ThrowsAsync<ConflictException>(() => service.CreateDepartmentAsync(request));
    }

    [Fact]
    public async Task UpdateDepartment_Assigns_Manager_Successfully()
    {
        using var context = CreateInMemoryDbContext();
        var dept = new Department { Name = "Sales" };
        context.Departments.Add(dept);
        await context.SaveChangesAsync();

        var user = new User { Email = "saleslead@company.com", PasswordHash = "hash", Role = UserRole.MANAGER };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            UserId = user.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "EMP005",
            FirstName = "Bob",
            LastName = "Jones",
            Position = "Sales Director",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.Add(emp);
        await context.SaveChangesAsync();

        var service = new DepartmentService(context, _logger);
        var request = new UpdateDepartmentRequestDto
        {
            Name = "Global Sales",
            Description = "Updated description",
            ManagerId = emp.Id
        };

        var result = await service.UpdateDepartmentAsync(dept.Id, request);

        Assert.Equal("Global Sales", result.Name);
        Assert.Equal("Updated description", result.Description);
        Assert.Equal(emp.Id, result.ManagerId);
        Assert.Equal("Bob Jones", result.ManagerName);
    }

    [Fact]
    public async Task UpdateDepartment_NonExistent_Throws_NotFoundException()
    {
        using var context = CreateInMemoryDbContext();
        var service = new DepartmentService(context, _logger);

        var request = new UpdateDepartmentRequestDto { Name = "Test" };
        await Assert.ThrowsAsync<NotFoundException>(() => service.UpdateDepartmentAsync(999, request));
    }
}
