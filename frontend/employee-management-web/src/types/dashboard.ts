// ============================================================
// Backend-aligned TypeScript types for Dashboard DTOs
// ============================================================

// ── Attendance ────────────────────────────────────────────
export interface AttendanceDtoFull {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeCode: string;
  departmentName: string;
  attendanceDate: string;
  checkIn?: string;
  checkOut?: string;
  status: string; // PRESENT | LATE | HALF_DAY | ABSENT
  notes?: string;
  workedHours?: number;
  hasMissingCheckOut: boolean;
}

export interface TodayAttendanceStateDto {
  state: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT';
  date: string;
  isWorkingDay: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  attendance?: AttendanceDtoFull;
}

// ── Leave Balance ─────────────────────────────────────────
export interface LeaveBalanceDtoFull {
  id: number;
  leaveTypeId: number;
  leaveTypeName: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  availableDays: number;
}

// ── Dashboard shared ──────────────────────────────────────
export interface DashboardLeaveRequestItemDto {
  id: number;
  leaveTypeId: number;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: string; // PENDING | APPROVED | REJECTED | CANCELLED
  reason?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
  // Manager list includes employee info
  employeeId?: number;
  employeeName?: string;
  employeeCode?: string;
}

export interface DashboardPendingApprovalDto {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  leaveTypeId: number;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  createdAt: string;
}

export interface TeamMemberStatusDto {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  status: string;
  checkIn: string;
  checkOut?: string;
  workedHours?: number;
}

export interface TeamMemberOnLeaveDto {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
}

export interface TeamMemberAbsentDto {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
}

export interface DashboardTeamStatusTodayDto {
  date: string;
  totalTeamMembers: number;
  presentCount: number;
  lateCount: number;
  onLeaveCount: number;
  absentCount: number;
  present: TeamMemberStatusDto[];
  late: TeamMemberStatusDto[];
  onLeave: TeamMemberOnLeaveDto[];
  absent: TeamMemberAbsentDto[];
}

export interface DashboardTeamMemberOnLeaveDto {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
}

export interface DepartmentHeadcountDto {
  departmentId: number;
  departmentName: string;
  totalEmployees: number;
  activeEmployees: number;
}

export interface MonthlyLeaveUsageDto {
  year: number;
  month: number;
  monthName: string;
  totalDays: number;
}

export interface AttendanceSummaryDtoAdmin {
  date?: string;
  totalEmployees?: number;
  presentCount: number;
  lateCount: number;
  onLeaveCount: number;
  absentCount: number;
}

// ── Role-specific dashboard payloads ──────────────────────
export interface EmployeeDashboardDto {
  employeeId: number;
  employeeName: string;
  departmentName: string;
  leaveBalances: LeaveBalanceDtoFull[];
  todayAttendance: TodayAttendanceStateDto;
  last5LeaveRequests: DashboardLeaveRequestItemDto[];
  upcomingApprovedLeave: DashboardLeaveRequestItemDto[];
}

export interface ManagerDashboardDto {
  departmentId?: number;
  departmentName?: string;
  pendingApprovalsCount: number;
  pendingApprovals: DashboardPendingApprovalDto[];
  teamStatusToday: DashboardTeamStatusTodayDto;
  teamMembersOnLeaveThisWeek: DashboardTeamMemberOnLeaveDto[];
}

export interface AdminDashboardDto {
  totalEmployees: number;
  activeEmployees: number;
  employeesPerDepartment: DepartmentHeadcountDto[];
  todayAttendanceSummary: AttendanceSummaryDtoAdmin;
  pendingLeaveCount: number;
  leaveDaysUsedThisMonth: number;
  leaveDaysPerMonthLast6Months: MonthlyLeaveUsageDto[];
}

export type DashboardPayload = EmployeeDashboardDto | ManagerDashboardDto | AdminDashboardDto;
