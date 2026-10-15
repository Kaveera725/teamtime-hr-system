using EmployeeManagement.API.Models;
using EmployeeManagement.API.Services;
using Xunit;

namespace EmployeeManagement.Tests;

public class AttendanceRuleEvaluatorTests
{
    [Theory]
    [InlineData(2026, 10, 12, true)]  // Monday
    [InlineData(2026, 10, 13, true)]  // Tuesday
    [InlineData(2026, 10, 14, true)]  // Wednesday
    [InlineData(2026, 10, 15, true)]  // Thursday
    [InlineData(2026, 10, 16, true)]  // Friday
    [InlineData(2026, 10, 17, false)] // Saturday
    [InlineData(2026, 10, 18, false)] // Sunday
    public void IsWorkingDay_Returns_True_For_MondayToFriday_Only(int year, int month, int day, bool expected)
    {
        var date = new DateOnly(year, month, day);
        var result = AttendanceRuleEvaluator.IsWorkingDay(date);
        Assert.Equal(expected, result);
    }

    [Theory]
    [InlineData(8, 30, AttendanceStatus.PRESENT)]
    [InlineData(9, 0, AttendanceStatus.PRESENT)]
    [InlineData(9, 1, AttendanceStatus.LATE)]
    [InlineData(9, 30, AttendanceStatus.LATE)]
    public void EvaluateCheckInStatus_Marks_LATE_When_After_Threshold(int hour, int minute, AttendanceStatus expected)
    {
        var checkInTime = new TimeOnly(hour, minute);
        var threshold = new TimeOnly(9, 0);

        var status = AttendanceRuleEvaluator.EvaluateCheckInStatus(checkInTime, threshold);
        Assert.Equal(expected, status);
    }

    [Fact]
    public void EvaluateCheckOutStatus_Marks_HALF_DAY_When_Under_4_Hours()
    {
        var checkIn = new DateTime(2026, 10, 14, 8, 30, 0, DateTimeKind.Utc);
        var checkOut = new DateTime(2026, 10, 14, 12, 0, 0, DateTimeKind.Utc); // 3.5 hours worked (< 4 hours)

        var status = AttendanceRuleEvaluator.EvaluateCheckOutStatus(checkIn, checkOut, AttendanceStatus.PRESENT);
        Assert.Equal(AttendanceStatus.HALF_DAY, status);
    }

    [Fact]
    public void EvaluateCheckOutStatus_Preserves_Status_When_4_Hours_Or_More()
    {
        var checkIn = new DateTime(2026, 10, 14, 8, 30, 0, DateTimeKind.Utc);
        var checkOut = new DateTime(2026, 10, 14, 17, 30, 0, DateTimeKind.Utc); // 9 hours worked

        var status = AttendanceRuleEvaluator.EvaluateCheckOutStatus(checkIn, checkOut, AttendanceStatus.PRESENT);
        Assert.Equal(AttendanceStatus.PRESENT, status);

        var lateStatus = AttendanceRuleEvaluator.EvaluateCheckOutStatus(checkIn, checkOut, AttendanceStatus.LATE);
        Assert.Equal(AttendanceStatus.LATE, lateStatus);
    }

    [Fact]
    public void IsMissedCheckOut_Flags_Record_For_Past_Dates()
    {
        var pastDate = new DateOnly(2026, 10, 10);
        var today = new DateOnly(2026, 10, 14);

        // Past record with no checkout -> true (BR-14)
        Assert.True(AttendanceRuleEvaluator.IsMissedCheckOut(pastDate, null, today));

        // Past record with checkout -> false
        Assert.False(AttendanceRuleEvaluator.IsMissedCheckOut(pastDate, DateTime.UtcNow, today));

        // Today record with no checkout (still open) -> false
        Assert.False(AttendanceRuleEvaluator.IsMissedCheckOut(today, null, today));
    }

    [Theory]
    [InlineData(true, false, false, true)]   // Working day, no check-in, no leave -> ABSENT (BR-13)
    [InlineData(true, true, false, false)]   // Working day, with check-in -> NOT absent
    [InlineData(true, false, true, false)]   // Working day, on approved leave -> NOT absent
    [InlineData(false, false, false, false)] // Weekend/holiday -> NOT absent
    public void IsAbsent_Returns_Expected_Result(bool isWorkingDay, bool hasAttendance, bool hasLeave, bool expected)
    {
        var result = AttendanceRuleEvaluator.IsAbsent(isWorkingDay, hasAttendance, hasLeave);
        Assert.Equal(expected, result);
    }
}

