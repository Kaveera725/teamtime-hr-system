using EmployeeManagement.API.Exceptions;
using EmployeeManagement.API.Services;
using Xunit;

namespace EmployeeManagement.Tests;

public class LeaveDayCalculatorTests
{
    [Fact]
    public void CalculateWorkingDays_SingleWeekday_ReturnsOne()
    {
        // 2026-10-14 is Wednesday
        var date = new DateOnly(2026, 10, 14);
        var result = LeaveDayCalculator.CalculateWorkingDays(date, date, false);
        Assert.Equal(1.0m, result);
    }

    [Fact]
    public void CalculateWorkingDays_FullWorkWeek_ReturnsFive()
    {
        // 2026-10-12 (Mon) to 2026-10-16 (Fri)
        var start = new DateOnly(2026, 10, 12);
        var end = new DateOnly(2026, 10, 16);
        var result = LeaveDayCalculator.CalculateWorkingDays(start, end, false);
        Assert.Equal(5.0m, result);
    }

    [Fact]
    public void CalculateWorkingDays_SpanningWeekend_ExcludesSaturdayAndSunday()
    {
        // 2026-10-15 (Thu) to 2026-10-20 (Tue)
        // Thu, Fri, Mon, Tue = 4 working days (Sat, Sun excluded per BR-01)
        var start = new DateOnly(2026, 10, 15);
        var end = new DateOnly(2026, 10, 20);
        var result = LeaveDayCalculator.CalculateWorkingDays(start, end, false);
        Assert.Equal(4.0m, result);
    }

    [Fact]
    public void CalculateWorkingDays_WeekendOnly_ThrowsBusinessRuleException()
    {
        // 2026-10-17 (Sat) to 2026-10-18 (Sun)
        var start = new DateOnly(2026, 10, 17);
        var end = new DateOnly(2026, 10, 18);
        var ex = Assert.Throws<BusinessRuleException>(() =>
            LeaveDayCalculator.CalculateWorkingDays(start, end, false));

        Assert.Contains("Selected dates do not contain any working days", ex.Message);
    }

    [Fact]
    public void CalculateWorkingDays_SingleSaturday_ThrowsBusinessRuleException()
    {
        // 2026-10-17 (Sat)
        var date = new DateOnly(2026, 10, 17);
        var ex = Assert.Throws<BusinessRuleException>(() =>
            LeaveDayCalculator.CalculateWorkingDays(date, date, false));

        Assert.Contains("Selected dates do not contain any working days", ex.Message);
    }

    [Fact]
    public void CalculateWorkingDays_HalfDay_SingleWeekday_ReturnsHalfDay()
    {
        // 2026-10-14 (Wed)
        var date = new DateOnly(2026, 10, 14);
        var result = LeaveDayCalculator.CalculateWorkingDays(date, date, true);
        Assert.Equal(0.5m, result);
    }

    [Fact]
    public void CalculateWorkingDays_HalfDay_MultipleDays_ThrowsBusinessRuleException()
    {
        // BR-02: start == end only
        var start = new DateOnly(2026, 10, 14);
        var end = new DateOnly(2026, 10, 15);
        var ex = Assert.Throws<BusinessRuleException>(() =>
            LeaveDayCalculator.CalculateWorkingDays(start, end, true));

        Assert.Contains("Half-day leave is only allowed when start date equals end date", ex.Message);
    }

    [Fact]
    public void CalculateWorkingDays_HalfDay_OnWeekend_ThrowsBusinessRuleException()
    {
        var saturday = new DateOnly(2026, 10, 17);
        var ex = Assert.Throws<BusinessRuleException>(() =>
            LeaveDayCalculator.CalculateWorkingDays(saturday, saturday, true));

        Assert.Contains("Selected dates do not contain any working days", ex.Message);
    }

    [Fact]
    public void CalculateWorkingDays_EndDateEarlierThanStartDate_ThrowsBusinessRuleException()
    {
        var start = new DateOnly(2026, 10, 16);
        var end = new DateOnly(2026, 10, 14);
        var ex = Assert.Throws<BusinessRuleException>(() =>
            LeaveDayCalculator.CalculateWorkingDays(start, end, false));

        Assert.Contains("End date cannot be earlier than start date", ex.Message);
    }

    [Fact]
    public void TryCalculateWorkingDays_WeekendOnly_ReturnsFalseWithErrorMessage()
    {
        var start = new DateOnly(2026, 10, 17);
        var end = new DateOnly(2026, 10, 18);
        var success = LeaveDayCalculator.TryCalculateWorkingDays(start, end, false, out var days, out var error);

        Assert.False(success);
        Assert.Equal(0m, days);
        Assert.Equal("Selected dates do not contain any working days.", error);
    }
}
