using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EmployeeManagement.API.Data.Configurations;

public class LeaveBalanceConfiguration : IEntityTypeConfiguration<LeaveBalance>
{
    public void Configure(EntityTypeBuilder<LeaveBalance> builder)
    {
        builder.ToTable("leave_balances",
            t => t.HasCheckConstraint("ck_leave_balances_used_days", "\"used_days\" >= 0"));

        builder.HasKey(lb => lb.Id);

        builder.Property(lb => lb.Id)
            .HasColumnName("id")
            .UseIdentityAlwaysColumn();

        builder.Property(lb => lb.EmployeeId)
            .HasColumnName("employee_id")
            .IsRequired();

        builder.Property(lb => lb.LeaveTypeId)
            .HasColumnName("leave_type_id")
            .IsRequired();

        builder.Property(lb => lb.Year)
            .HasColumnName("year")
            .IsRequired();

        builder.Property(lb => lb.AllocatedDays)
            .HasColumnName("allocated_days")
            .HasColumnType("numeric(4,1)")
            .IsRequired();

        builder.Property(lb => lb.UsedDays)
            .HasColumnName("used_days")
            .HasColumnType("numeric(4,1)")
            .HasDefaultValue(0m)
            .IsRequired();

        builder.Property(lb => lb.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(lb => lb.UpdatedAt)
            .HasColumnName("updated_at")
            .HasColumnType("timestamptz")
            .IsRequired();

        // Computed - not a stored column
        builder.Ignore(lb => lb.RemainingDays);

        // Unique: leave_balances(employee_id, leave_type_id, year) (Section 7.9, BR-15)
        builder.HasIndex(lb => new { lb.EmployeeId, lb.LeaveTypeId, lb.Year })
            .IsUnique()
            .HasDatabaseName("ix_leave_balances_employee_type_year");

        // FK: leave_balances.employee_id -> employees.id (restrictive)
        builder.HasOne(lb => lb.Employee)
            .WithMany(e => e.LeaveBalances)
            .HasForeignKey(lb => lb.EmployeeId)
            .HasConstraintName("fk_leave_balances_employee")
            .OnDelete(DeleteBehavior.Restrict);

        // FK: leave_balances.leave_type_id -> leave_types.id (restrictive)
        builder.HasOne(lb => lb.LeaveType)
            .WithMany(lt => lt.LeaveBalances)
            .HasForeignKey(lb => lb.LeaveTypeId)
            .HasConstraintName("fk_leave_balances_leave_type")
            .OnDelete(DeleteBehavior.Restrict);
    }
}
