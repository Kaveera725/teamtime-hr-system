using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EmployeeManagement.API.Data;
using EmployeeManagement.API.DTOs.Auth;
using EmployeeManagement.API.DTOs.User;
using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Interfaces;
using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace EmployeeManagement.API.Services;

public class AuthService : IAuthService
{
    private readonly ApplicationDbContext _dbContext;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthService> _logger;

    public AuthService(ApplicationDbContext dbContext, IConfiguration configuration, ILogger<AuthService> logger)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<LoginResponseDto> LoginAsync(LoginRequestDto request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        var user = await _dbContext.Users
            .Include(u => u.Employee)
            .ThenInclude(e => e!.Department)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            _logger.LogWarning("Failed login attempt for email {Email}", request.Email);
            throw new BusinessRuleException("Invalid email or password.", "password");
        }

        // BR / FR-AUTH-05: Deactivated accounts cannot log in
        if (user.Employee != null && user.Employee.Status == EmployeeStatus.INACTIVE)
        {
            _logger.LogWarning("Deactivated user {Email} attempted login", request.Email);
            throw new BusinessRuleException("Your account is deactivated. Please contact an administrator.");
        }

        var (token, expiresAt) = GenerateJwtToken(user);

        return new LoginResponseDto
        {
            Token = token,
            ExpiresAt = expiresAt,
            User = new UserSummaryDto
            {
                Id = user.Id,
                Email = user.Email,
                Role = user.Role.ToString(),
                EmployeeId = user.Employee?.Id,
                FullName = user.Employee != null ? $"{user.Employee.FirstName} {user.Employee.LastName}" : null
            }
        };
    }

    public async Task<CurrentUserProfileDto> GetCurrentUserProfileAsync(long userId)
    {
        var user = await _dbContext.Users
            .Include(u => u.Employee)
            .ThenInclude(e => e!.Department)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            throw new NotFoundException("User not found.");
        }

        if (user.Employee == null)
        {
            throw new NotFoundException("Employee profile not associated with this user.");
        }

        return new CurrentUserProfileDto
        {
            UserId = user.Id,
            Email = user.Email,
            Role = user.Role.ToString(),
            EmployeeId = user.Employee.Id,
            EmployeeCode = user.Employee.EmployeeCode,
            FullName = $"{user.Employee.FirstName} {user.Employee.LastName}",
            FirstName = user.Employee.FirstName,
            LastName = user.Employee.LastName,
            DepartmentName = user.Employee.Department?.Name ?? string.Empty,
            Position = user.Employee.Position
        };
    }

    public async Task ChangePasswordAsync(long userId, ChangePasswordRequestDto request)
    {
        var user = await _dbContext.Users.FindAsync(userId);
        if (user == null)
        {
            throw new NotFoundException("User not found.");
        }

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            throw new BusinessRuleException("Current password is incorrect.", "currentPassword");
        }

        ValidatePasswordComplexity(request.NewPassword);

        if (BCrypt.Net.BCrypt.Verify(request.NewPassword, user.PasswordHash))
        {
            throw new BusinessRuleException("New password cannot be the same as current password.", "newPassword");
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.UpdatedAt = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("Password successfully changed for user ID {UserId}", userId);
    }

    public async Task<UserSummaryDto> CreateUserAsync(CreateUserRequestDto request)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();

        if (await _dbContext.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail))
        {
            throw new ConflictException($"User with email '{request.Email}' already exists.");
        }

        var department = await _dbContext.Departments.FindAsync(request.DepartmentId);
        if (department == null)
        {
            throw new NotFoundException($"Department with ID {request.DepartmentId} not found.");
        }

        ValidatePasswordComplexity(request.Password);

        // Generate or validate employee code
        var employeeCode = request.EmployeeCode?.Trim();
        if (string.IsNullOrWhiteSpace(employeeCode))
        {
            var nextNum = await _dbContext.Employees.CountAsync() + 1;
            employeeCode = $"EMP-{nextNum:D4}";
        }
        else if (await _dbContext.Employees.AnyAsync(e => e.EmployeeCode == employeeCode))
        {
            throw new ConflictException($"Employee code '{employeeCode}' already exists.");
        }

        var user = new User
        {
            Email = normalizedEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = request.Role,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var employee = new Employee
        {
            User = user,
            EmployeeCode = employeeCode,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Phone = request.Phone?.Trim(),
            DepartmentId = department.Id,
            Position = request.Position.Trim(),
            JoinedDate = DateOnly.FromDateTime(DateTime.UtcNow),
            Status = EmployeeStatus.ACTIVE,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _dbContext.Users.AddAsync(user);
        await _dbContext.Employees.AddAsync(employee);
        await _dbContext.SaveChangesAsync();

        // Seed initial leave balances for the new employee (FR-LEV-09)
        var currentYear = DateTime.UtcNow.Year;
        var activeLeaveTypes = await _dbContext.LeaveTypes.Where(lt => lt.IsActive).ToListAsync();

        foreach (var lt in activeLeaveTypes)
        {
            _dbContext.LeaveBalances.Add(new LeaveBalance
            {
                EmployeeId = employee.Id,
                LeaveTypeId = lt.Id,
                Year = currentYear,
                AllocatedDays = lt.DefaultDays,
                UsedDays = 0,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync();
        _logger.LogInformation("New user {Email} ({Role}) created with employee ID {EmployeeId}", user.Email, user.Role, employee.Id);

        return new UserSummaryDto
        {
            Id = user.Id,
            Email = user.Email,
            Role = user.Role.ToString(),
            EmployeeId = employee.Id,
            FullName = $"{employee.FirstName} {employee.LastName}"
        };
    }

    private (string token, DateTime expiresAt) GenerateJwtToken(User user)
    {
        var jwtKey = _configuration["Jwt:Key"]
            ?? _configuration["Jwt__Key"]
            ?? "super_secret_jwt_key_that_is_at_least_32_characters_long_for_security";
        var jwtIssuer = _configuration["Jwt:Issuer"]
            ?? _configuration["Jwt__Issuer"]
            ?? "EmployeeManagementAPI";
        var jwtAudience = _configuration["Jwt:Audience"]
            ?? _configuration["Jwt__Audience"]
            ?? "EmployeeManagementWeb";

        var expiryMinutesStr = _configuration["Jwt:ExpiryMinutes"]
            ?? _configuration["Jwt__ExpiryMinutes"]
            ?? "60";

        if (!int.TryParse(expiryMinutesStr, out var expiryMinutes))
        {
            expiryMinutes = 60;
        }

        var expiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("userId", user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new("role", user.Role.ToString()),
            new(ClaimTypes.Role, user.Role.ToString())
        };

        if (user.Employee != null)
        {
            claims.Add(new Claim("employeeId", user.Employee.Id.ToString()));
            claims.Add(new Claim("employeeCode", user.Employee.EmployeeCode));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = expiresAt,
            Issuer = jwtIssuer,
            Audience = jwtAudience,
            SigningCredentials = creds
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var securityToken = tokenHandler.CreateToken(tokenDescriptor);
        var tokenString = tokenHandler.WriteToken(securityToken);

        return (tokenString, expiresAt);
    }

    private static void ValidatePasswordComplexity(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
        {
            throw new BusinessRuleException("Password must be at least 8 characters long.", "password");
        }

        var hasUpper = password.Any(char.IsUpper);
        var hasLower = password.Any(char.IsLower);
        var hasDigit = password.Any(char.IsDigit);
        var hasSpecial = password.Any(ch => !char.IsLetterOrDigit(ch));

        if (!hasUpper || !hasLower || !hasDigit || !hasSpecial)
        {
            throw new BusinessRuleException(
                "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
                "password");
        }
    }
}
