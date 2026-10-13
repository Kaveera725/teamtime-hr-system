using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Leave;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;

namespace EmployeeManagement.API.Services;

/// <summary>
/// Service managing leave type definitions and policies (Section 3.5, 7.6, 8.5, FR-LEV-08).
/// </summary>
public class LeaveTypeService : ILeaveTypeService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly ILogger<LeaveTypeService> _logger;

    public LeaveTypeService(ApplicationDbContext dbContext, ILogger<LeaveTypeService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Retrieves all leave types. Available to all authenticated users for dropdowns and balance displays.
    /// </summary>
    /// <param name="includeInactive">If true, includes deactivated leave types (useful for Admin management).</param>
    public async Task<IReadOnlyList<LeaveTypeDto>> GetLeaveTypesAsync(bool includeInactive = false)
    {
        var query = _dbContext.LeaveTypes.AsNoTracking();

        if (!includeInactive)
        {
            query = query.Where(lt => lt.IsActive);
        }

        return await query
            .OrderBy(lt => lt.Name)
            .Select(lt => new LeaveTypeDto
            {
                Id = lt.Id,
                Name = lt.Name,
                Description = lt.Description,
                DefaultDays = lt.DefaultDays,
                IsActive = lt.IsActive,
                CreatedAt = lt.CreatedAt
            })
            .ToListAsync();
    }

    /// <summary>
    /// Retrieves a single leave type by ID.
    /// </summary>
    public async Task<LeaveTypeDto> GetLeaveTypeByIdAsync(long id)
    {
        var leaveType = await _dbContext.LeaveTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(lt => lt.Id == id);

        if (leaveType == null)
        {
            throw new NotFoundException($"Leave type with ID {id} not found.");
        }

        return new LeaveTypeDto
        {
            Id = leaveType.Id,
            Name = leaveType.Name,
            Description = leaveType.Description,
            DefaultDays = leaveType.DefaultDays,
            IsActive = leaveType.IsActive,
            CreatedAt = leaveType.CreatedAt
        };
    }

    /// <summary>
    /// Creates a new leave type (FR-LEV-08). Admin only.
    /// </summary>
    public async Task<LeaveTypeDto> CreateLeaveTypeAsync(CreateLeaveTypeRequestDto request)
    {
        var normalizedName = request.Name.Trim();

        if (await _dbContext.LeaveTypes.AnyAsync(lt => lt.Name.ToLower() == normalizedName.ToLower()))
        {
            throw new ConflictException($"Leave type with name '{normalizedName}' already exists.");
        }

        var leaveType = new LeaveType
        {
            Name = normalizedName,
            Description = request.Description?.Trim(),
            DefaultDays = request.DefaultDays,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };

        await _dbContext.LeaveTypes.AddAsync(leaveType);
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Leave type '{Name}' created with ID {Id}", leaveType.Name, leaveType.Id);

        return new LeaveTypeDto
        {
            Id = leaveType.Id,
            Name = leaveType.Name,
            Description = leaveType.Description,
            DefaultDays = leaveType.DefaultDays,
            IsActive = leaveType.IsActive,
            CreatedAt = leaveType.CreatedAt
        };
    }

    /// <summary>
    /// Updates an existing leave type's details or default allocation (FR-LEV-08). Admin only.
    /// </summary>
    public async Task<LeaveTypeDto> UpdateLeaveTypeAsync(long id, UpdateLeaveTypeRequestDto request)
    {
        var leaveType = await _dbContext.LeaveTypes.FirstOrDefaultAsync(lt => lt.Id == id);
        if (leaveType == null)
        {
            throw new NotFoundException($"Leave type with ID {id} not found.");
        }

        var normalizedName = request.Name.Trim();
        if (await _dbContext.LeaveTypes.AnyAsync(lt => lt.Id != id && lt.Name.ToLower() == normalizedName.ToLower()))
        {
            throw new ConflictException($"Leave type with name '{normalizedName}' already exists.");
        }

        leaveType.Name = normalizedName;
        leaveType.Description = request.Description?.Trim();
        leaveType.DefaultDays = request.DefaultDays;

        if (request.IsActive.HasValue)
        {
            leaveType.IsActive = request.IsActive.Value;
        }

        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Leave type ID {Id} updated", leaveType.Id);

        return new LeaveTypeDto
        {
            Id = leaveType.Id,
            Name = leaveType.Name,
            Description = leaveType.Description,
            DefaultDays = leaveType.DefaultDays,
            IsActive = leaveType.IsActive,
            CreatedAt = leaveType.CreatedAt
        };
    }

    /// <summary>
    /// Deactivates a leave type (FR-LEV-08). Admin only.
    /// </summary>
    public async Task<LeaveTypeDto> DeactivateLeaveTypeAsync(long id)
    {
        var leaveType = await _dbContext.LeaveTypes.FirstOrDefaultAsync(lt => lt.Id == id);
        if (leaveType == null)
        {
            throw new NotFoundException($"Leave type with ID {id} not found.");
        }

        leaveType.IsActive = false;
        await _dbContext.SaveChangesAsync();

        _logger.LogInformation("Leave type ID {Id} deactivated", leaveType.Id);

        return new LeaveTypeDto
        {
            Id = leaveType.Id,
            Name = leaveType.Name,
            Description = leaveType.Description,
            DefaultDays = leaveType.DefaultDays,
            IsActive = leaveType.IsActive,
            CreatedAt = leaveType.CreatedAt
        };
    }
}
