using EmployeeManagement.API.Models;

namespace EmployeeManagement.API.Services;

/// <summary>
/// Pure, testable class encapsulating attendance business rules and status evaluations
/// (BR-01, BR-10, BR-11, BR-12, BR-13, BR-14). Contains no database dependencies.
/// </summary>
public static class AttendanceRuleEvaluator
{
    public static readonly TimeOnly DefaultLateThreshold = new(9, 0); // 09:00 local time (BR-11)
    public static readonly TimeSpan HalfDayThreshold = TimeSpan.FromHours(4); // Under 4 hours is HALF_DAY (BR-12)

    /// <summary>
    /// Checks whether a given calendar date falls on a standard working day (Monday - Friday per BR-01, BR-10).
    /// </summary>
    public static bool IsWorkingDay(DateOnly date)
    {
        return date.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday);
    }

    /// <summary>
    /// Evaluates the attendance status upon check-in based on the configured late threshold (BR-11).
    /// A check-in after the threshold (default 09:00) is marked LATE; otherwise PRESENT.
    /// </summary>
    /// <param name="checkInTime">The time of day the check-in occurred.</param>
    /// <param name="lateThreshold">The cutoff threshold time (default 09:00).</param>
    public static AttendanceStatus EvaluateCheckInStatus(TimeOnly checkInTime, TimeOnly lateThreshold)
    {
        return checkInTime > lateThreshold
            ? AttendanceStatus.LATE
            : AttendanceStatus.PRESENT;
    }

    /// <summary>
    /// Evaluates the final attendance status upon check-out (BR-12).
    /// If total worked duration is under 4 hours, status is updated to HALF_DAY regardless of check-in time.
    /// If 4 hours or more, the check-in status (PRESENT or LATE) is preserved.
    /// </summary>
    /// <param name="checkIn">The check-in timestamp.</param>
    /// <param name="checkOut">The check-out timestamp.</param>
    /// <param name="initialStatus">The status computed on check-in (PRESENT or LATE).</param>
    public static AttendanceStatus EvaluateCheckOutStatus(DateTime checkIn, DateTime checkOut, AttendanceStatus initialStatus)
    {
        var duration = checkOut - checkIn;
        if (duration < TimeSpan.Zero)
        {
            throw new ArgumentException("Check-out time cannot be before check-in time.", nameof(checkOut));
        }

        if (duration < HalfDayThreshold)
        {
            return AttendanceStatus.HALF_DAY;
        }

        return initialStatus;
    }

    /// <summary>
    /// Calculates total worked hours as a rounded decimal value.
    /// </summary>
    public static double? CalculateWorkedHours(DateTime checkIn, DateTime? checkOut)
    {
        if (!checkOut.HasValue)
        {
            return null;
        }

        var duration = checkOut.Value - checkIn;
        return Math.Max(0, Math.Round(duration.TotalHours, 2));
    }

    /// <summary>
    /// Checks if a record represents a missed check-out (BR-14).
    /// A record without check-out stays open and is flagged for correction once the working day has passed.
    /// </summary>
    public static bool IsMissedCheckOut(DateOnly attendanceDate, DateTime? checkOut, DateOnly currentDate)
    {
        return !checkOut.HasValue && attendanceDate < currentDate;
    }

    /// <summary>
    /// Parses the configured LateAfter string (e.g. "09:00" or "09:30").
    /// Falls back to 09:00 if invalid or null.
    /// </summary>
    public static TimeOnly ParseLateThreshold(string? thresholdStr)
    {
        if (!string.IsNullOrWhiteSpace(thresholdStr) && TimeOnly.TryParse(thresholdStr, out var parsed))
        {
            return parsed;
        }

        return DefaultLateThreshold;
    }

    /// <summary>
    /// Evaluates whether an employee is marked ABSENT on a date (BR-13).
    /// A working day with no attendance record and no approved leave is reported as ABSENT.
    /// </summary>
    /// <param name="isWorkingDay">True if the date is a working day (Mon-Fri).</param>
    /// <param name="hasAttendanceRecord">True if the employee has checked in on this date.</param>
    /// <param name="hasApprovedLeave">True if the employee has an approved leave request covering this date.</param>
    public static bool IsAbsent(bool isWorkingDay, bool hasAttendanceRecord, bool hasApprovedLeave)
    {
        return isWorkingDay && !hasAttendanceRecord && !hasApprovedLeave;
    }
}

