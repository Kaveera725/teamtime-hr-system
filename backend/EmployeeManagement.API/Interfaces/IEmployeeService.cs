using EmployeeManagement.API.DTOs.Common;
using EmployeeManagement.API.DTOs.Employee;

namespace EmployeeManagement.API.Interfaces;

public interface IEmployeeService
{
    Task<PagedResult<EmployeeListDto>> GetEmployeesAsync(EmployeeQueryParameters parameters, CurrentUserContext currentUser);
    Task<EmployeeDetailDto> GetEmployeeByIdAsync(long id, CurrentUserContext currentUser);
    Task<EmployeeDetailDto> CreateEmployeeAsync(CreateEmployeeRequestDto request);
    Task<EmployeeDetailDto> UpdateEmployeeAsync(long id, UpdateEmployeeRequestDto request);
    Task SoftDeleteEmployeeAsync(long id);
    Task<string> GenerateNextEmployeeCodeAsync();
}
