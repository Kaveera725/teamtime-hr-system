using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EmployeeManagement.API.Data.Configurations;

public class LeaveRequestConfiguration : IEntityTypeConfiguration<LeaveRequest>
{
    public void Configure(EntityTypeBuilder<LeaveRequest> builder)
    {
        builder.ToTable("leave_requests",
            t => t.HasCheckConstraint("ck_leave_requests_end_date", "\"end_date\" >= \"start_date\""));

        builder.HasKey(lr => lr.Id);

        builder.Property(lr => lr.Id)
            .HasColumnName("id")
            .UseIdentityAlwaysColumn();

        builder.Property(lr => lr.EmployeeId)
            .HasColumnName("employee_id")
            .IsRequired();

        builder.Property(lr => lr.LeaveTypeId)
            .HasColumnName("leave_type_id")
            .IsRequired();

        builder.Property(lr => lr.StartDate)
            .HasColumnName("start_date")
            .HasColumnType("date")
            .IsRequired();

        builder.Property(lr => lr.EndDate)
            .HasColumnName("end_date")
            .HasColumnType("date")
            .IsRequired();

        builder.Property(lr => lr.TotalDays)
            .HasColumnName("total_days")
            .HasColumnType("numeric(4,1)")
            .IsRequired();

        builder.Property(lr => lr.Reason)
            .HasColumnName("reason");

        builder.Property(lr => lr.Status)
            .HasColumnName("status")
            .HasMaxLength(30)
            .HasConversion<string>()    // Store enum as string
            .IsRequired();

        builder.Property(lr => lr.ApprovedById)
            .HasColumnName("approved_by");

        builder.Property(lr => lr.ApprovedAt)
            .HasColumnName("approved_at")
            .HasColumnType("timestamptz");

        builder.Property(lr => lr.RejectionReason)
            .HasColumnName("rejection_reason");

        builder.Property(lr => lr.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(lr => lr.UpdatedAt)
            .HasColumnName("updated_at")
            .HasColumnType("timestamptz")
            .IsRequired();

        // Map xmin PostgreSQL system column as optimistic concurrency token (Section 7.7, NFR-03)
        // UseXminAsConcurrencyToken() was removed in Npgsql 7+; use IsRowVersion() on uint property instead
        builder.Property(lr => lr.Version)
            .IsRowVersion()     // Maps to PostgreSQL xmin system column - no migration column needed
            .HasColumnName("xmin");

        // Performance indexes (Section 7.9)
        builder.HasIndex(lr => new { lr.EmployeeId, lr.Status })
            .HasDatabaseName("ix_leave_requests_employee_status");

        builder.HasIndex(lr => new { lr.StartDate, lr.EndDate })
            .HasDatabaseName("ix_leave_requests_dates");

        // FK: leave_requests.employee_id -> employees.id (restrictive)
        builder.HasOne(lr => lr.Employee)
            .WithMany(e => e.LeaveRequests)
            .HasForeignKey(lr => lr.EmployeeId)
            .HasConstraintName("fk_leave_requests_employee")
            .OnDelete(DeleteBehavior.Restrict);

        // FK: leave_requests.leave_type_id -> leave_types.id (restrictive)
        builder.HasOne(lr => lr.LeaveType)
            .WithMany(lt => lt.LeaveRequests)
            .HasForeignKey(lr => lr.LeaveTypeId)
            .HasConstraintName("fk_leave_requests_leave_type")
            .OnDelete(DeleteBehavior.Restrict);

        // FK: leave_requests.approved_by -> employees.id (restrictive, nullable)
        builder.HasOne(lr => lr.ApprovedBy)
            .WithMany(e => e.ApprovedLeaveRequests)
            .HasForeignKey(lr => lr.ApprovedById)
            .HasConstraintName("fk_leave_requests_approved_by")
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
