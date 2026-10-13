using EmployeeManagement.API.DTOs.Auth;
using EmployeeManagement.API.DTOs.User;

namespace EmployeeManagement.API.Interfaces;

public interface IAuthService
{
    Task<LoginResponseDto> LoginAsync(LoginRequestDto request);
    Task<CurrentUserProfileDto> GetCurrentUserProfileAsync(long userId);
    Task ChangePasswordAsync(long userId, ChangePasswordRequestDto request);
    Task<UserSummaryDto> CreateUserAsync(CreateUserRequestDto request);
}
