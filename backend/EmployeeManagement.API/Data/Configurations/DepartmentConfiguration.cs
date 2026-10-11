using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EmployeeManagement.API.Data.Configurations;

public class DepartmentConfiguration : IEntityTypeConfiguration<Department>
{
    public void Configure(EntityTypeBuilder<Department> builder)
    {
        builder.ToTable("departments");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.Id)
            .HasColumnName("id")
            .UseIdentityAlwaysColumn();

        builder.Property(d => d.Name)
            .HasColumnName("name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(d => d.Description)
            .HasColumnName("description");

        builder.Property(d => d.ManagerId)
            .HasColumnName("manager_id");

        builder.Property(d => d.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamptz")
            .IsRequired();

        // Unique index on name (Section 7.9)
        builder.HasIndex(d => d.Name)
            .IsUnique()
            .HasDatabaseName("ix_departments_name");

        // FK: departments.manager_id -> employees.id  (nullable, circular)
        // Configured explicitly to break EF Core circular FK ambiguity (Section 7.4 note)
        builder.HasOne(d => d.Manager)
            .WithOne(e => e.ManagedDepartment)
            .HasForeignKey<Department>(d => d.ManagerId)
            .HasConstraintName("fk_departments_manager")
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        // Seed data (Section 7.10) – ManagerId left null; assigned by Admin later
        builder.HasData(
            new Department { Id = 1, Name = "IT",        Description = "Information Technology department", ManagerId = null, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Department { Id = 2, Name = "HR",        Description = "Human Resources department",        ManagerId = null, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Department { Id = 3, Name = "Finance",   Description = "Finance and Accounting department", ManagerId = null, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new Department { Id = 4, Name = "Marketing", Description = "Marketing and Sales department",    ManagerId = null, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
        );
    }
}
