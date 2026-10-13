using EmployeeManagement.API.Models;

namespace EmployeeManagement.API.DTOs.Employee;

public class EmployeeQueryParameters
{
    public string? Search { get; set; }
    public long? DepartmentId { get; set; }
    public EmployeeStatus? Status { get; set; }
    public string? SortBy { get; set; } = "employeeCode";
    public string? SortOrder { get; set; } = "asc";
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}
