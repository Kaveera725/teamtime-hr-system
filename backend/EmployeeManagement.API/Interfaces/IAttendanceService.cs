using EmployeeManagement.API.DTOs.Attendance;
using EmployeeManagement.API.DTOs.Common;

namespace EmployeeManagement.API.Interfaces;

public interface IAttendanceService
{
    Task<AttendanceDto> CheckInAsync(long userId, CheckInRequestDto? request = null, DateTime? checkInTime = null);
    Task<AttendanceDto> CheckOutAsync(long userId, CheckOutRequestDto? request = null, DateTime? checkOutTime = null);
    Task<TodayAttendanceStateDto> GetMyTodayStateAsync(long userId);
    Task<IReadOnlyList<AttendanceDto>> GetMyAttendanceHistoryAsync(long userId, DateOnly? from, DateOnly? to);
    Task<IReadOnlyList<AttendanceDto>> GetEmployeeAttendanceHistoryAsync(long targetEmployeeId, DateOnly? from, DateOnly? to, CurrentUserContext currentUser);
    Task<AttendanceSummaryDto> GetTodaySummaryAsync(CurrentUserContext currentUser, DateOnly? targetDate = null);
}
