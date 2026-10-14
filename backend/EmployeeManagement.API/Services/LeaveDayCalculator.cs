using EmployeeManagement.API.Exceptions;

namespace EmployeeManagement.API.Services;

/// <summary>
/// Pure calculation class for leave days based on business rules (BR-01, BR-02).
/// Contains no database dependencies.
/// </summary>
public static class LeaveDayCalculator
{
    /// <summary>
    /// Calculates the number of working days between two dates inclusive (Mon - Fri per BR-01, BR-02).
    /// Supports half-day leave (0.5 days, only valid when start == end per BR-02).
    /// Rejects requests that contain zero working days (weekends only).
    /// </summary>
    /// <param name="startDate">Leave start date</param>
    /// <param name="endDate">Leave end date</param>
    /// <param name="isHalfDay">True if requesting a half-day</param>
    /// <returns>Calculated working days (e.g. 0.5, 1.0, 2.0, ...)</returns>
    /// <exception cref="BusinessRuleException">Thrown when validation fails or zero working days found</exception>
    public static decimal CalculateWorkingDays(DateOnly startDate, DateOnly endDate, bool isHalfDay = false)
    {
        if (endDate < startDate)
        {
            throw new BusinessRuleException("End date cannot be earlier than start date.");
        }

        if (isHalfDay)
        {
            if (startDate != endDate)
            {
                throw new BusinessRuleException("Half-day leave is only allowed when start date equals end date.");
            }

            if (IsWeekend(startDate))
            {
                throw new BusinessRuleException("Selected dates do not contain any working days.");
            }

            return 0.5m;
        }

        int workingDays = 0;
        for (var current = startDate; current <= endDate; current = current.AddDays(1))
        {
            if (!IsWeekend(current))
            {
                workingDays++;
            }
        }

        if (workingDays == 0)
        {
            throw new BusinessRuleException("Selected dates do not contain any working days.");
        }

        return workingDays;
    }

    /// <summary>
    /// Attempts to calculate working days without throwing an exception.
    /// Useful for preview endpoints to report validation failures cleanly.
    /// </summary>
    public static bool TryCalculateWorkingDays(
        DateOnly startDate,
        DateOnly endDate,
        bool isHalfDay,
        out decimal workingDays,
        out string? errorMessage)
    {
        workingDays = 0m;
        errorMessage = null;

        if (endDate < startDate)
        {
            errorMessage = "End date cannot be earlier than start date.";
            return false;
        }

        if (isHalfDay)
        {
            if (startDate != endDate)
            {
                errorMessage = "Half-day leave is only allowed when start date equals end date.";
                return false;
            }

            if (IsWeekend(startDate))
            {
                errorMessage = "Selected dates do not contain any working days.";
                return false;
            }

            workingDays = 0.5m;
            return true;
        }

        int count = 0;
        for (var current = startDate; current <= endDate; current = current.AddDays(1))
        {
            if (!IsWeekend(current))
            {
                count++;
            }
        }

        if (count == 0)
        {
            errorMessage = "Selected dates do not contain any working days.";
            return false;
        }

        workingDays = count;
        return true;
    }

    /// <summary>
    /// Returns true if the specified date falls on a Saturday or Sunday.
    /// </summary>
    public static bool IsWeekend(DateOnly date)
    {
        return date.DayOfWeek == DayOfWeek.Saturday || date.DayOfWeek == DayOfWeek.Sunday;
    }
}
