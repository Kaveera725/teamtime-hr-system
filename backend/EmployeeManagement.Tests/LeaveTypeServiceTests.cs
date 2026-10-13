using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Leave;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Models;
using EmployeeManagement.API.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Xunit;

namespace EmployeeManagement.Tests;

public class LeaveTypeServiceTests
{
    private readonly ILogger<LeaveTypeService> _logger;

    public LeaveTypeServiceTests()
    {
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddConsole());
        _logger = loggerFactory.CreateLogger<LeaveTypeService>();
    }

    private static ApplicationDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new ApplicationDbContext(options);
    }

    [Fact]
    public async Task GetLeaveTypes_Returns_Only_Active_By_Default()
    {
        using var context = CreateInMemoryDbContext();
        context.LeaveTypes.AddRange(
            new LeaveType { Name = "Active Type", DefaultDays = 10, IsActive = true },
            new LeaveType { Name = "Inactive Type", DefaultDays = 5, IsActive = false }
        );
        await context.SaveChangesAsync();

        var service = new LeaveTypeService(context, _logger);
        var activeTypes = await service.GetLeaveTypesAsync(includeInactive: false);
        var allTypes = await service.GetLeaveTypesAsync(includeInactive: true);

        Assert.Single(activeTypes);
        Assert.Equal("Active Type", activeTypes[0].Name);
        Assert.Equal(2, allTypes.Count);
    }

    [Fact]
    public async Task CreateLeaveType_Creates_Successfully()
    {
        using var context = CreateInMemoryDbContext();
        var service = new LeaveTypeService(context, _logger);

        var request = new CreateLeaveTypeRequestDto
        {
            Name = "Paternity Leave",
            Description = "Leave for new fathers",
            DefaultDays = 5,
            IsActive = true
        };

        var result = await service.CreateLeaveTypeAsync(request);

        Assert.True(result.Id > 0);
        Assert.Equal("Paternity Leave", result.Name);
        Assert.Equal(5, result.DefaultDays);
        Assert.True(result.IsActive);
    }

    [Fact]
    public async Task CreateLeaveType_Duplicate_Throws_ConflictException()
    {
        using var context = CreateInMemoryDbContext();
        context.LeaveTypes.Add(new LeaveType { Name = "Study Leave", DefaultDays = 10 });
        await context.SaveChangesAsync();

        var service = new LeaveTypeService(context, _logger);
        var request = new CreateLeaveTypeRequestDto { Name = "study leave", DefaultDays = 10 };

        await Assert.ThrowsAsync<ConflictException>(() => service.CreateLeaveTypeAsync(request));
    }

    [Fact]
    public async Task UpdateLeaveType_Updates_Successfully()
    {
        using var context = CreateInMemoryDbContext();
        var lt = new LeaveType { Name = "Old Name", DefaultDays = 10, IsActive = true };
        context.LeaveTypes.Add(lt);
        await context.SaveChangesAsync();

        var service = new LeaveTypeService(context, _logger);
        var updateRequest = new UpdateLeaveTypeRequestDto
        {
            Name = "New Name",
            Description = "Updated description",
            DefaultDays = 12,
            IsActive = true
        };

        var updated = await service.UpdateLeaveTypeAsync(lt.Id, updateRequest);

        Assert.Equal("New Name", updated.Name);
        Assert.Equal(12, updated.DefaultDays);
    }

    [Fact]
    public async Task DeactivateLeaveType_Sets_IsActive_False()
    {
        using var context = CreateInMemoryDbContext();
        var lt = new LeaveType { Name = "Active Type", DefaultDays = 10, IsActive = true };
        context.LeaveTypes.Add(lt);
        await context.SaveChangesAsync();

        var service = new LeaveTypeService(context, _logger);
        var result = await service.DeactivateLeaveTypeAsync(lt.Id);

        Assert.False(result.IsActive);
        var inDb = await context.LeaveTypes.FindAsync(lt.Id);
        Assert.NotNull(inDb);
        Assert.False(inDb.IsActive);
    }
}
