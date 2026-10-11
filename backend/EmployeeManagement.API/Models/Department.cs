namespace EmployeeManagement.API.Models;

public class Department
{
    public long Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public long? ManagerId { get; set; }       // Nullable FK to employees (circular)
    public DateTime CreatedAt { get; set; }

    // Navigation
    public Employee? Manager { get; set; }
    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
