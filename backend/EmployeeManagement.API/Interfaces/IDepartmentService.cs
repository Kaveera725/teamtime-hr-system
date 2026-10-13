using EmployeeManagement.API.DTOs.Department;

namespace EmployeeManagement.API.Interfaces;

public interface IDepartmentService
{
    Task<IReadOnlyList<DepartmentDto>> GetAllDepartmentsAsync();
    Task<DepartmentDto> GetDepartmentByIdAsync(long id);
    Task<DepartmentDto> CreateDepartmentAsync(CreateDepartmentRequestDto request);
    Task<DepartmentDto> UpdateDepartmentAsync(long id, UpdateDepartmentRequestDto request);
}
