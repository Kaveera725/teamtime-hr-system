using EmployeeManagement.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EmployeeManagement.API.Data.Configurations;

public class AttendanceConfiguration : IEntityTypeConfiguration<Attendance>
{
    public void Configure(EntityTypeBuilder<Attendance> builder)
    {
        builder.ToTable("attendance");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .HasColumnName("id")
            .UseIdentityAlwaysColumn();

        builder.Property(a => a.EmployeeId)
            .HasColumnName("employee_id")
            .IsRequired();

        builder.Property(a => a.AttendanceDate)
            .HasColumnName("attendance_date")
            .HasColumnType("date")
            .IsRequired();

        builder.Property(a => a.CheckIn)
            .HasColumnName("check_in")
            .HasColumnType("timestamptz")
            .IsRequired();

        builder.Property(a => a.CheckOut)
            .HasColumnName("check_out")
            .HasColumnType("timestamptz");

        builder.Property(a => a.Status)
            .HasColumnName("status")
            .HasMaxLength(30)
            .HasConversion<string>()    // Store enum as string
            .IsRequired();

        builder.Property(a => a.Notes)
            .HasColumnName("notes");

        builder.Property(a => a.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamptz")
            .IsRequired();

        // Unique: attendance(employee_id, attendance_date) (Section 7.9, FR-ATT-01, BR-10)
        builder.HasIndex(a => new { a.EmployeeId, a.AttendanceDate })
            .IsUnique()
            .HasDatabaseName("ix_attendance_employee_date");

        // Performance index on attendance_date (Section 7.9)
        builder.HasIndex(a => a.AttendanceDate)
            .HasDatabaseName("ix_attendance_date");

        // FK: attendance.employee_id -> employees.id (restrictive)
        builder.HasOne(a => a.Employee)
            .WithMany(e => e.Attendances)
            .HasForeignKey(a => a.EmployeeId)
            .HasConstraintName("fk_attendance_employee")
            .OnDelete(DeleteBehavior.Restrict);
    }
}
