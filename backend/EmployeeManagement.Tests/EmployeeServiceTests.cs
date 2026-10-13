using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Employee;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Models;
using EmployeeManagement.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Xunit;

namespace EmployeeManagement.Tests;

public class EmployeeServiceTests
{
    private readonly ILogger<EmployeeService> _logger;

    public EmployeeServiceTests()
    {
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        _logger = loggerFactory.CreateLogger<EmployeeService>();
    }

    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task CreateEmployee_AutoGenerates_EMP001_And_Seeds_LeaveBalances_FR_LEV_09()
    {
        using var context = CreateInMemoryDbContext();
        var dept = new Department { Name = "IT" };
        context.Departments.Add(dept);

        var user = new User { Email = "developer@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE, IsActive = true };
        context.Users.Add(user);

        // Seed leave types
        context.LeaveTypes.AddRange(
            new LeaveType { Name = "Annual Leave", DefaultDays = 14, IsActive = true },
            new LeaveType { Name = "Casual Leave", DefaultDays = 7, IsActive = true },
            new LeaveType { Name = "Medical Leave", DefaultDays = 14, IsActive = true },
            new LeaveType { Name = "Inactive Type", DefaultDays = 5, IsActive = false }
        );
        await context.SaveChangesAsync();

        var service = new EmployeeService(context, _logger);
        var request = new CreateEmployeeRequestDto
        {
            UserId = user.Id,
            DepartmentId = dept.Id,
            FirstName = "John",
            LastName = "Doe",
            Position = "Software Engineer"
        };

        var result = await service.CreateEmployeeAsync(request);

        Assert.Equal("EMP001", result.EmployeeCode);
        Assert.Equal("John Doe", result.FullName);
        Assert.Equal("developer@company.com", result.Email);
        Assert.Equal("IT", result.DepartmentName);
        Assert.Equal("ACTIVE", result.Status);

        // Check seeded leave balances (only active leave types, for current year)
        var balances = await context.LeaveBalances.Where(lb => lb.EmployeeId == result.Id).ToListAsync();
        Assert.Equal(3, balances.Count);
        Assert.All(balances, b => Assert.Equal(DateTime.UtcNow.Year, b.Year));
        Assert.All(balances, b => Assert.Equal(0, b.UsedDays));
    }

    [Fact]
    public async Task CreateEmployee_Sequential_Codes_EMP001_EMP002()
    {
        using var context = CreateInMemoryDbContext();
        var dept = new Department { Name = "IT" };
        context.Departments.Add(dept);

        var user1 = new User { Email = "user1@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        var user2 = new User { Email = "user2@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.AddRange(user1, user2);
        await context.SaveChangesAsync();

        var service = new EmployeeService(context, _logger);

        var emp1 = await service.CreateEmployeeAsync(new CreateEmployeeRequestDto
        {
            UserId = user1.Id,
            DepartmentId = dept.Id,
            FirstName = "First",
            LastName = "User",
            Position = "Dev"
        });

        var emp2 = await service.CreateEmployeeAsync(new CreateEmployeeRequestDto
        {
            UserId = user2.Id,
            DepartmentId = dept.Id,
            FirstName = "Second",
            LastName = "User",
            Position = "QA"
        });

        Assert.Equal("EMP001", emp1.EmployeeCode);
        Assert.Equal("EMP002", emp2.EmployeeCode);
    }

    [Fact]
    public async Task CreateEmployee_UserAlreadyLinked_Throws_ConflictException()
    {
        using var context = CreateInMemoryDbContext();
        var dept = new Department { Name = "IT" };
        context.Departments.Add(dept);

        var user = new User { Email = "linked@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var service = new EmployeeService(context, _logger);
        await service.CreateEmployeeAsync(new CreateEmployeeRequestDto
        {
            UserId = user.Id,
            DepartmentId = dept.Id,
            FirstName = "John",
            LastName = "Doe",
            Position = "Dev"
        });

        // Try creating second employee with same user
        await Assert.ThrowsAsync<ConflictException>(() => service.CreateEmployeeAsync(new CreateEmployeeRequestDto
        {
            UserId = user.Id,
            DepartmentId = dept.Id,
            FirstName = "Another",
            LastName = "Name",
            Position = "Dev"
        }));
    }

    [Fact]
    public async Task SoftDeleteEmployee_Sets_INACTIVE_And_Deactivates_User_FR_AUTH_05()
    {
        using var context = CreateInMemoryDbContext();
        var dept = new Department { Name = "HR" };
        context.Departments.Add(dept);

        var user = new User { Email = "to_delete@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE, IsActive = true };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            UserId = user.Id,
            DepartmentId = dept.Id,
            EmployeeCode = "EMP010",
            FirstName = "Test",
            LastName = "Employee",
            Position = "Recruiter",
            Status = EmployeeStatus.ACTIVE
        };
        context.Employees.Add(emp);
        await context.SaveChangesAsync();

        var service = new EmployeeService(context, _logger);
        await service.SoftDeleteEmployeeAsync(emp.Id);

        var updatedEmp = await context.Employees.FindAsync(emp.Id);
        var updatedUser = await context.Users.FindAsync(user.Id);

        Assert.NotNull(updatedEmp);
        Assert.Equal(EmployeeStatus.INACTIVE, updatedEmp.Status);
        Assert.NotNull(updatedUser);
        Assert.False(updatedUser.IsActive);
    }

    [Fact]
    public async Task Employee_Requesting_Another_Employee_Record_Gets_ForbiddenException_403()
    {
        using var context = CreateInMemoryDbContext();
        var dept = new Department { Name = "IT" };
        context.Departments.Add(dept);

        var user1 = new User { Id = 10, Email = "emp1@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        var user2 = new User { Id = 20, Email = "emp2@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.AddRange(user1, user2);
        await context.SaveChangesAsync();

        var emp1 = new Employee { Id = 100, UserId = user1.Id, DepartmentId = dept.Id, EmployeeCode = "EMP001", FirstName = "Emp", LastName = "One", Position = "Dev", Status = EmployeeStatus.ACTIVE };
        var emp2 = new Employee { Id = 200, UserId = user2.Id, DepartmentId = dept.Id, EmployeeCode = "EMP002", FirstName = "Emp", LastName = "Two", Position = "Dev", Status = EmployeeStatus.ACTIVE };
        context.Employees.AddRange(emp1, emp2);
        await context.SaveChangesAsync();

        var service = new EmployeeService(context, _logger);

        // Employee 1 accesses their own record -> Allowed
        var ownContext = new CurrentUserContext { UserId = user1.Id, Role = "EMPLOYEE", EmployeeId = emp1.Id };
        var selfResult = await service.GetEmployeeByIdAsync(emp1.Id, ownContext);
        Assert.Equal("EMP001", selfResult.EmployeeCode);

        // Employee 1 accesses Employee 2's record -> 403 ForbiddenException
        await Assert.ThrowsAsync<ForbiddenException>(() => service.GetEmployeeByIdAsync(emp2.Id, ownContext));
    }

    [Fact]
    public async Task Manager_Access_Restricted_To_Own_Department()
    {
        using var context = CreateInMemoryDbContext();
        var itDept = new Department { Id = 1, Name = "IT" };
        var hrDept = new Department { Id = 2, Name = "HR" };
        context.Departments.AddRange(itDept, hrDept);
        await context.SaveChangesAsync();

        var managerUser = new User { Id = 1, Email = "itmanager@company.com", PasswordHash = "hash", Role = UserRole.MANAGER };
        var itUser = new User { Id = 2, Email = "itemp@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        var hrUser = new User { Id = 3, Email = "hremp@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.AddRange(managerUser, itUser, hrUser);
        await context.SaveChangesAsync();

        var managerEmp = new Employee { Id = 10, UserId = managerUser.Id, DepartmentId = itDept.Id, EmployeeCode = "EMP001", FirstName = "IT", LastName = "Manager", Position = "Lead", Status = EmployeeStatus.ACTIVE };
        var itEmp = new Employee { Id = 20, UserId = itUser.Id, DepartmentId = itDept.Id, EmployeeCode = "EMP002", FirstName = "IT", LastName = "Dev", Position = "Dev", Status = EmployeeStatus.ACTIVE };
        var hrEmp = new Employee { Id = 30, UserId = hrUser.Id, DepartmentId = hrDept.Id, EmployeeCode = "EMP003", FirstName = "HR", LastName = "Officer", Position = "HR", Status = EmployeeStatus.ACTIVE };
        context.Employees.AddRange(managerEmp, itEmp, hrEmp);
        await context.SaveChangesAsync();

        itDept.ManagerId = managerEmp.Id;
        await context.SaveChangesAsync();

        var service = new EmployeeService(context, _logger);
        var managerContext = new CurrentUserContext { UserId = managerUser.Id, Role = "MANAGER", EmployeeId = managerEmp.Id };

        // Manager can view employee in their IT department
        var teamEmp = await service.GetEmployeeByIdAsync(itEmp.Id, managerContext);
        Assert.Equal("EMP002", teamEmp.EmployeeCode);

        // Manager CANNOT view employee in HR department -> ForbiddenException
        await Assert.ThrowsAsync<ForbiddenException>(() => service.GetEmployeeByIdAsync(hrEmp.Id, managerContext));
    }

    [Fact]
    public async Task Admin_Can_Access_Any_Employee()
    {
        using var context = CreateInMemoryDbContext();
        var dept = new Department { Name = "Finance" };
        context.Departments.Add(dept);
        await context.SaveChangesAsync();

        var user = new User { Email = "finance@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var emp = new Employee { UserId = user.Id, DepartmentId = dept.Id, EmployeeCode = "EMP099", FirstName = "Fin", LastName = "User", Position = "Accountant", Status = EmployeeStatus.ACTIVE };
        context.Employees.Add(emp);
        await context.SaveChangesAsync();

        var service = new EmployeeService(context, _logger);
        var adminContext = new CurrentUserContext { UserId = 999, Role = "ADMIN", EmployeeId = null };

        var result = await service.GetEmployeeByIdAsync(emp.Id, adminContext);
        Assert.Equal("EMP099", result.EmployeeCode);
    }

    [Fact]
    public async Task GetEmployees_Search_And_Filter_Works()
    {
        using var context = CreateInMemoryDbContext();
        var dept1 = new Department { Id = 1, Name = "IT" };
        var dept2 = new Department { Id = 2, Name = "HR" };
        context.Departments.AddRange(dept1, dept2);
        await context.SaveChangesAsync();

        var u1 = new User { Email = "alice@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        var u2 = new User { Email = "bob@company.com", PasswordHash = "hash", Role = UserRole.EMPLOYEE };
        context.Users.AddRange(u1, u2);
        await context.SaveChangesAsync();

        context.Employees.AddRange(
            new Employee { UserId = u1.Id, DepartmentId = dept1.Id, EmployeeCode = "EMP001", FirstName = "Alice", LastName = "Smith", Position = "Developer", Status = EmployeeStatus.ACTIVE },
            new Employee { UserId = u2.Id, DepartmentId = dept2.Id, EmployeeCode = "EMP002", FirstName = "Bob", LastName = "Jones", Position = "Recruiter", Status = EmployeeStatus.INACTIVE }
        );
        await context.SaveChangesAsync();

        var service = new EmployeeService(context, _logger);
        var adminContext = new CurrentUserContext { UserId = 1, Role = "ADMIN" };

        // Search by name
        var searchResult = await service.GetEmployeesAsync(new EmployeeQueryParameters { Search = "Alice" }, adminContext);
        Assert.Single(searchResult.Items);
        Assert.Equal("Alice Smith", searchResult.Items[0].FullName);

        // Filter by Status ACTIVE
        var activeResult = await service.GetEmployeesAsync(new EmployeeQueryParameters { Status = EmployeeStatus.ACTIVE }, adminContext);
        Assert.Single(activeResult.Items);
        Assert.Equal("EMP001", activeResult.Items[0].EmployeeCode);

        // Filter by Department HR
        var hrResult = await service.GetEmployeesAsync(new EmployeeQueryParameters { DepartmentId = dept2.Id }, adminContext);
        Assert.Single(hrResult.Items);
        Assert.Equal("EMP002", hrResult.Items[0].EmployeeCode);
    }
}
