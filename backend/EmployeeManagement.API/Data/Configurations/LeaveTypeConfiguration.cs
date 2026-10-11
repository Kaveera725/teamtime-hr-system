using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EmployeeManagement.API.Data.Configurations;

public class LeaveTypeConfiguration : IEntityTypeConfiguration<LeaveType>
{
    public void Configure(EntityTypeBuilder<LeaveType> builder)
    {
        builder.ToTable("leave_types");

        builder.HasKey(lt => lt.Id);

        builder.Property(lt => lt.Id)
            .HasColumnName("id")
            .UseIdentityAlwaysColumn();

        builder.Property(lt => lt.Name)
            .HasColumnName("name")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(lt => lt.Description)
            .HasColumnName("description");

        builder.Property(lt => lt.DefaultDays)
            .HasColumnName("default_days")
            .HasColumnType("numeric(4,1)")
            .IsRequired();

        builder.Property(lt => lt.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true)
            .IsRequired();

        builder.Property(lt => lt.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamptz")
            .IsRequired();

        // Unique: leave_types(name) (Section 7.9)
        builder.HasIndex(lt => lt.Name)
            .IsUnique()
            .HasDatabaseName("ix_leave_types_name");

        // Seed data (Section 7.10)
        builder.HasData(
            new LeaveType { Id = 1, Name = "Annual Leave",  Description = "Annual paid leave entitlement", DefaultDays = 14, IsActive = true, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new LeaveType { Id = 2, Name = "Casual Leave",  Description = "Short-notice casual absence",   DefaultDays = 7,  IsActive = true, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new LeaveType { Id = 3, Name = "Medical Leave", Description = "Sick / medical leave (backdatable up to 3 days per BR-09)", DefaultDays = 14, IsActive = true, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) },
            new LeaveType { Id = 4, Name = "No Pay Leave",  Description = "Unpaid leave – balance check exempt per BR-04", DefaultDays = 0,  IsActive = true, CreatedAt = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) }
        );
    }
}
