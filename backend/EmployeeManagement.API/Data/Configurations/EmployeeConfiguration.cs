using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EmployeeManagement.API.Data.Configurations;

public class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("employees");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .UseIdentityAlwaysColumn();

        builder.Property(e => e.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(e => e.EmployeeCode)
            .HasColumnName("employee_code")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.FirstName)
            .HasColumnName("first_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.LastName)
            .HasColumnName("last_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.Phone)
            .HasColumnName("phone")
            .HasMaxLength(20);

        builder.Property(e => e.DepartmentId)
            .HasColumnName("department_id")
            .IsRequired();

        builder.Property(e => e.Position)
            .HasColumnName("position")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.JoinedDate)
            .HasColumnName("joined_date")
            .HasColumnType("date")
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasMaxLength(30)
            .HasConversion<string>()    // Store enum as string
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("updated_at")
            .HasColumnType("timestamptz")
            .IsRequired();

        // Ignore computed property - not a column
        builder.Ignore(e => e.FullName);

        // Unique: employees(employee_code), employees(user_id) (Section 7.9)
        builder.HasIndex(e => e.EmployeeCode)
            .IsUnique()
            .HasDatabaseName("ix_employees_employee_code");

        builder.HasIndex(e => e.UserId)
            .IsUnique()
            .HasDatabaseName("ix_employees_user_id");

        // FK: employees.user_id -> users.id  (restrictive, one-to-one)
        builder.HasOne(e => e.User)
            .WithOne(u => u.Employee)
            .HasForeignKey<Employee>(e => e.UserId)
            .HasConstraintName("fk_employees_user")
            .OnDelete(DeleteBehavior.Restrict);

        // FK: employees.department_id -> departments.id  (restrictive, many-to-one)
        // The inverse (Department.Manager) is configured in DepartmentConfiguration
        builder.HasOne(e => e.Department)
            .WithMany(d => d.Employees)
            .HasForeignKey(e => e.DepartmentId)
            .HasConstraintName("fk_employees_department")
            .OnDelete(DeleteBehavior.Restrict);
    }
}
