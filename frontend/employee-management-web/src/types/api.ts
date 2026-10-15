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
  id: string;
  name: string;
  description?: string;
  defaultDays: number;
  requiresDocumentation: boolean;
  isActive: boolean;
}

// ── Leave Balance ─────────────────────────────────────────
export interface LeaveBalanceDto {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  year: number;
  allocated: number;
  used: number;
  pending: number;
  remaining: number;
}

// ── Leave Request ─────────────────────────────────────────
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequestDto {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  approvedById?: string;
  approvedByName?: string;
  rejectionReason?: string;
  appliedAt: string;
  processedAt?: string;
}

export interface CreateLeaveRequest {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  halfDay?: boolean;
}

export interface LeavePreviewResponse {
  workingDays: number;
  balanceAfter: number;
  violations: string[];
}

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
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';

export interface AttendanceDto {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  workedMinutes?: number;
  status: AttendanceStatus;
  notes?: string;
}

export interface AttendanceTodayState {
  date: string;
  state: 'NOT_CHECKED_IN' | 'CHECKED_IN' | 'CHECKED_OUT';
  checkInTime?: string;
  checkOutTime?: string;
  workedMinutes?: number;
  status?: AttendanceStatus;
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
