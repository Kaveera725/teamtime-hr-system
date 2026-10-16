// ============================================================
// TypeScript DTOs matching the backend API contracts
// ============================================================

export type Role = 'Admin' | 'Manager' | 'Employee' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export interface UserSummaryDto {
  id: number;
  email: string;
  role: string;
  employeeId?: number | null;
  fullName?: string | null;
}

// ── Auth ──────────────────────────────────────────────────
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt?: string;
  user?: UserSummaryDto;
  employeeId?: string;
  name?: string;
  email?: string;
  role?: Role;
  departmentId?: string | null;
}

// ── Employee ──────────────────────────────────────────────
export interface EmployeeDto {
  id: string;
  employeeNumber: string;
  name: string;
  email: string;
  position: string;
  role: Role;
  isActive: boolean;
  joinDate: string;
  departmentId: string | null;
  departmentName: string | null;
  managerId: string | null;
  managerName: string | null;
}

export interface CreateEmployeeRequest {
  name: string;
  email: string;
  password: string;
  position: string;
  role: Role;
  departmentId?: string;
  joinDate: string;
}

export interface UpdateEmployeeRequest {
  name?: string;
  position?: string;
  role?: Role;
  departmentId?: string;
  isActive?: boolean;
}

// ── Department ────────────────────────────────────────────
export interface DepartmentDto {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  managerName?: string;
  employeeCount: number;
}

// ── Leave Types ───────────────────────────────────────────
export interface LeaveTypeDto {
  id: number | string;
  name: string;
  description?: string | null;
  defaultDays: number;
  requiresDocumentation?: boolean;
  isActive: boolean;
  createdAt?: string;
}

// ── Leave Balance ─────────────────────────────────────────
export interface LeaveBalanceDto {
  id: number | string;
  leaveTypeId: number | string;
  leaveTypeName: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  availableDays?: number;
  // Legacy aliases
  allocated?: number;
  used?: number;
  pending?: number;
  remaining?: number;
}

// ── Leave Request ─────────────────────────────────────────
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequestDto {
  id: number;
  employeeId: number;
  employeeCode?: string;
  employeeName: string;
  departmentId?: number | null;
  departmentName?: string | null;
  leaveTypeId: number;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string | null;
  status: LeaveStatus;
  approvedById?: number | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  appliedAt?: string;
  processedAt?: string;
}

export interface CreateLeaveRequestDto {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  reason?: string | null;
}

// Backwards compatibility alias
export type CreateLeaveRequest = CreateLeaveRequestDto;

export interface LeaveRequestPreviewRequestDto {
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
}

export interface LeaveRequestPreviewResponseDto {
  workingDays: number;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  availableBalance: number;
  balanceAfter: number;
  isValid: boolean;
  validationErrors: string[];
}

// Backwards compatibility alias
export type LeavePreviewResponse = LeaveRequestPreviewResponseDto;

export interface ProcessLeaveRequest {
  rejectionReason?: string;
}

export interface LeaveListParams {
  status?: LeaveStatus;
  employeeId?: string;
  departmentId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

// ── Attendance ────────────────────────────────────────────
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'ON_LEAVE' | 'WEEKEND';

export interface AttendanceDto {
  id: string | number;
  employeeId: string | number;
  employeeName: string;
  employeeCode?: string;
  departmentName?: string;
  attendanceDate: string; // ISO date YYYY-MM-DD
  date?: string;          // Alias for convenience
  checkIn?: string;       // ISO datetime string
  checkInTime?: string;   // Alias
  checkOut?: string;      // ISO datetime string
  checkOutTime?: string;  // Alias
  workedHours?: number;
  workedMinutes?: number;
  status: string;
  notes?: string;
  hasMissingCheckOut?: boolean;
}

export interface TodayAttendanceStateDto {
  state: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT';
  date: string;
  isWorkingDay: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  attendance?: AttendanceDto | null;
  // Legacy / convenience fields
  checkInTime?: string;
  checkOutTime?: string;
  workedMinutes?: number;
  status?: AttendanceStatus | string;
}

// Keep AttendanceTodayState alias for backwards compatibility
export type AttendanceTodayState = TodayAttendanceStateDto;

export interface AttendanceSummaryDto {
  date: string;
  totalEmployees: number;
  presentCount: number;
  lateCount: number;
  halfDayCount: number;
  onLeaveCount: number;
  absentCount: number;
  presentEmployees: AttendanceItemDto[];
  lateEmployees: AttendanceItemDto[];
  onLeaveEmployees: OnLeaveItemDto[];
  absentEmployees: AbsentItemDto[];
}

export interface AttendanceItemDto {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  checkIn: string;
  checkOut?: string;
  status: string;
  workedHours?: number;
}

export interface OnLeaveItemDto {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  departmentName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
}

export interface AbsentItemDto {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  departmentName: string;
}

export interface AttendanceSummary {
  date: string;
  presentCount: number;
  lateCount: number;
  onLeaveCount: number;
  absentCount: number;
  present: AttendanceDto[];
  late: AttendanceDto[];
  onLeave: EmployeeDto[];
  absent: EmployeeDto[];
}

// ── Dashboard ─────────────────────────────────────────────
export interface EmployeeDashboard {
  leaveBalances: LeaveBalanceDto[];
  todayAttendance: AttendanceTodayState;
  recentLeaveRequests: LeaveRequestDto[];
  upcomingLeave: LeaveRequestDto[];
}

export interface ManagerDashboard {
  pendingApprovalsCount: number;
  pendingApprovals: LeaveRequestDto[];
  teamTodaySummary: {
    present: Array<{ id: string; name: string }>;
    late: Array<{ id: string; name: string }>;
    onLeave: Array<{ id: string; name: string }>;
    absent: Array<{ id: string; name: string }>;
  };
  teamOnLeaveThisWeek: LeaveRequestDto[];
}

export interface AdminDashboard {
  totalEmployees: number;
  activeEmployees: number;
  employeesPerDepartment: Array<{ department: string; count: number }>;
  todayAttendanceSummary: {
    present: number;
    late: number;
    onLeave: number;
    absent: number;
  };
  pendingLeaveCount: number;
  leaveDaysUsedThisMonth: number;
  leaveDaysPerMonth: Array<{ month: string; days: number }>;
}

// ── Pagination ────────────────────────────────────────────
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── API Error ─────────────────────────────────────────────
export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors?: Record<string, string[]>;
}
