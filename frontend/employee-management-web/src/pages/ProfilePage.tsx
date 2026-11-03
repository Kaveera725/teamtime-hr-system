import React, { useState, useMemo } from 'react';
import {
  User,
  Shield,
  Palette,
  Briefcase,
  Mail,
  Building2,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Check,
  Sun,
  Moon,
  Laptop,
  Loader2,
  CalendarCheck,
  Info,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar } from '@/components/ui/Avatar';
import { cn, formatDate } from '@/lib/utils';
import type {
  CurrentUserProfileDto,
  EmployeeDetailDto,
  LeaveBalanceDto,
  AttendanceDto,
  ChangePasswordRequestDto,
} from '@/types/api';

// Password rules evaluation helper
interface PasswordChecklist {
  hasMinLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
  matchesConfirm: boolean;
}

const evaluatePassword = (password: string, confirm: string): PasswordChecklist => {
  return {
    hasMinLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
    matchesConfirm: Boolean(password && confirm && password === confirm),
  };
};

const getStrengthScore = (checks: PasswordChecklist, password: string): { score: number; label: string; color: string } => {
  if (!password) return { score: 0, label: 'None', color: 'bg-neutral-200 dark:bg-neutral-800' };

  let passed = 0;
  if (checks.hasMinLength) passed++;
  if (checks.hasUpper) passed++;
  if (checks.hasLower) passed++;
  if (checks.hasDigit) passed++;
  if (checks.hasSpecial) passed++;

  if (passed <= 2) {
    return { score: 1, label: 'Weak', color: 'bg-rose-500' };
  }
  if (passed === 3) {
    return { score: 2, label: 'Fair', color: 'bg-amber-500' };
  }
  if (passed === 4) {
    return { score: 3, label: 'Good', color: 'bg-sky-500' };
  }
  return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
};

export const ProfilePage: React.FC = () => {
  const { user: authUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'details' | 'security' | 'preferences'>('details');

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // 1. Fetch current user core profile (/auth/me)
  const { data: profile } = useQuery<CurrentUserProfileDto>({
    queryKey: ['currentUserProfile'],
    queryFn: async () => {
      const res = await api.get<CurrentUserProfileDto>('/auth/me');
      return res.data;
    },
    enabled: !!authUser,
  });

  // 2. Fetch full employee details if employeeId exists
  const employeeId = profile?.employeeId || (authUser?.employeeId ? Number(authUser.employeeId) : null);
  const { data: employeeDetail } = useQuery<EmployeeDetailDto>({
    queryKey: ['employeeDetail', employeeId],
    queryFn: async () => {
      if (!employeeId) throw new Error('No employee ID available');
      const res = await api.get<EmployeeDetailDto>(`/employees/${employeeId}`);
      return res.data;
    },
    enabled: !!employeeId,
  });

  // 3. Fetch this user's leave balances
  const {
    data: leaveBalances = [],
    isLoading: isBalancesLoading,
  } = useQuery<LeaveBalanceDto[]>({
    queryKey: ['myLeaveBalances'],
    queryFn: async () => {
      const res = await api.get<LeaveBalanceDto[]>('/leave-balances/my');
      return res.data;
    },
    enabled: !!authUser,
  });

  // 4. Fetch this month's attendance records
  const now = new Date();
  const fromDate = format(startOfMonth(now), 'yyyy-MM-dd');
  const toDate = format(endOfMonth(now), 'yyyy-MM-dd');

  const {
    data: attendanceRecords = [],
    isLoading: isAttendanceLoading,
  } = useQuery<AttendanceDto[]>({
    queryKey: ['myAttendanceMonth', fromDate, toDate],
    queryFn: async () => {
      const res = await api.get<AttendanceDto[]>('/attendance/my', {
        params: { from: fromDate, to: toDate },
      });
      return res.data;
    },
    enabled: !!authUser,
  });

  // Calculate this month's attendance summary stats
  const attendanceStats = useMemo(() => {
    let presentDays = 0;
    let lateDays = 0;
    let onLeaveDays = 0;
    let totalWorkedHours = 0;

    for (const r of attendanceRecords) {
      const status = (r.status || '').toUpperCase();
      if (status === 'PRESENT') {
        presentDays++;
      } else if (status === 'LATE') {
        lateDays++;
        presentDays++;
      } else if (status === 'HALF_DAY') {
        presentDays++;
      } else if (status === 'ON_LEAVE') {
        onLeaveDays++;
      }

      if (r.workedHours && r.workedHours > 0) {
        totalWorkedHours += r.workedHours;
      }
    }

    return {
      presentDays,
      lateDays,
      onLeaveDays,
      totalWorkedHours: Math.round(totalWorkedHours * 10) / 10,
    };
  }, [attendanceRecords]);

  // Password checklist & strength
  const checklist = useMemo(
    () => evaluatePassword(newPassword, confirmPassword),
    [newPassword, confirmPassword]
  );
  const strength = useMemo(
    () => getStrengthScore(checklist, newPassword),
    [checklist, newPassword]
  );

  const isFormValid =
    Boolean(currentPassword) &&
    checklist.hasMinLength &&
    checklist.hasUpper &&
    checklist.hasLower &&
    checklist.hasDigit &&
    checklist.hasSpecial &&
    checklist.matchesConfirm;

  // Change Password Mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (payload: ChangePasswordRequestDto) => {
      const res = await api.post('/auth/change-password', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Password changed successfully!', {
        description: 'Your security credentials have been updated.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    },
    onError: (err) => {
      const msg = getErrorMessage(err);
      setPasswordError(msg);
      toast.error('Failed to change password', { description: msg });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Current password is required.');
      return;
    }

    if (!isFormValid) {
      setPasswordError('Please meet all password requirements before proceeding.');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password cannot be the same as your current password.');
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    toast.success(
      `Theme updated to ${newTheme.charAt(0).toUpperCase() + newTheme.slice(1)} mode`
    );
  };

  const roleName = profile?.role || authUser?.role || 'Employee';
  const roleBadgeColor: Record<string, string> = {
    Admin: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    ADMIN: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    Manager: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    MANAGER: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    Employee: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    EMPLOYEE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  };

  const displayName = profile?.fullName || employeeDetail?.fullName || authUser?.name || 'User Profile';
  const displayCode = profile?.employeeCode || employeeDetail?.employeeCode || 'EMP';
  const displayEmail = profile?.email || authUser?.email || '';
  const displayPosition = profile?.position || employeeDetail?.position || 'Team Member';
  const displayDepartment = profile?.departmentName || employeeDetail?.departmentName || 'General';

  return (
    <div className="space-y-6 page-enter pb-16 max-w-6xl mx-auto">
      {/* ── 1. Profile Header Banner ─────────────────────────────────── */}
      <div className="card p-6 md:p-8 bg-gradient-to-r from-primary-900/10 via-primary-500/5 to-transparent border border-neutral-200 dark:border-neutral-800 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          <Avatar
            name={displayName}
            size="xl"
            className="ring-4 ring-white dark:ring-neutral-800 shadow-lg text-xl"
          />

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 justify-center sm:justify-start">
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
                {displayName}
              </h1>

              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span
                  className={cn(
                    'text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
                    roleBadgeColor[roleName] || roleBadgeColor.Employee
                  )}
                >
                  {roleName}
                </span>

                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                  {displayCode}
                </span>
              </div>
            </div>

            <p className="text-sm text-neutral-600 dark:text-neutral-400 flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200">
                <Briefcase className="h-4 w-4 text-primary-500" />
                {displayPosition}
              </span>
              <span className="hidden sm:inline text-neutral-300 dark:text-neutral-700">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-neutral-400" />
                {displayDepartment}
              </span>
              <span className="hidden sm:inline text-neutral-300 dark:text-neutral-700">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-neutral-400" />
                {displayEmail}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. Quick Overview Small Cards ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card A: This Month's Attendance Summary */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                This Month's Attendance
              </h2>
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              {format(now, 'MMMM yyyy')}
            </span>
          </div>

          {isAttendanceLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 space-y-2">
                  <div className="skeleton h-3 w-16" />
                  <div className="skeleton h-6 w-10" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 text-center">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">
                  Days Present
                </span>
                <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {attendanceStats.presentDays}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-medium">
                  Logged in
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 text-center">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">
                  Hours Logged
                </span>
                <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {attendanceStats.totalWorkedHours}
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                  Total hrs
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 text-center">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">
                  Punctuality
                </span>
                <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {attendanceStats.lateDays > 0 ? `${attendanceStats.lateDays} Late` : '100%'}
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                  {attendanceStats.lateDays > 0 ? 'Recorded' : 'On-time'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 text-center">
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 block">
                  On Leave
                </span>
                <span className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {attendanceStats.onLeaveDays}
                </span>
                <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                  Approved days
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Card B: This User's Leave Balances */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Leave Balances ({now.getFullYear()})
              </h2>
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Annual Allocation
            </span>
          </div>

          {isBalancesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 space-y-2">
                  <div className="skeleton h-3 w-28" />
                  <div className="skeleton h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : leaveBalances.length === 0 ? (
            <div className="text-center py-6 text-xs text-neutral-500 dark:text-neutral-400">
              No leave balances currently allocated for {now.getFullYear()}.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto pr-1">
              {leaveBalances.map((b) => {
                const allocated = b.allocatedDays ?? b.allocated ?? 0;
                const used = b.usedDays ?? b.used ?? 0;
                const pending = b.pendingDays ?? b.pending ?? 0;
                const remaining = b.remainingDays ?? b.remaining ?? 0;
                const percentage = allocated > 0 ? Math.min(100, Math.round((used / allocated) * 100)) : 0;

                return (
                  <div
                    key={b.id}
                    className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[130px]">
                        {b.leaveTypeName}
                      </span>
                      <span className="font-bold text-primary-600 dark:text-primary-400">
                        {remaining}d left
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full transition-all duration-300',
                          percentage > 85 ? 'bg-amber-500' : 'bg-primary-500'
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span>{used} used / {allocated} total</span>
                      {pending > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          {pending} pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Profile Tabs Navigation ──────────────────────────────── */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 flex gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={cn(
            'flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition-all',
            activeTab === 'details'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          )}
        >
          <User className="h-4 w-4" />
          <span>Job Details</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={cn(
            'flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition-all',
            activeTab === 'security'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          )}
        >
          <Shield className="h-4 w-4" />
          <span>Security & Password</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={cn(
            'flex items-center gap-2 pb-3 px-1 text-sm font-semibold border-b-2 transition-all',
            activeTab === 'preferences'
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          )}
        >
          <Palette className="h-4 w-4" />
          <span>Preferences & Theme</span>
        </button>
      </div>

      {/* ── 4. Tab 1: Details (Read-only Job Info) ──────────────────── */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          <div className="card p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Employment & Identity Details
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Official employee record and contact information.
                </p>
              </div>

              <span className="badge badge-success">
                {employeeDetail?.status || 'ACTIVE'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-5 gap-x-8">
              {/* Employee Code */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Employee Code
                </span>
                <p className="text-sm font-semibold font-mono text-neutral-900 dark:text-neutral-100">
                  {displayCode}
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Full Name
                </span>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {displayName}
                </p>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Work Email Address
                </span>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {displayEmail}
                </p>
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Phone Number
                </span>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {employeeDetail?.phone || 'Not provided'}
                </p>
              </div>

              {/* Position */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Job Position
                </span>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {displayPosition}
                </p>
              </div>

              {/* Department */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Assigned Department
                </span>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {displayDepartment}
                </p>
              </div>

              {/* Managed Department (if any) */}
              {employeeDetail?.managedDepartmentName && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Department Managed
                  </span>
                  <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {employeeDetail.managedDepartmentName}
                  </p>
                </div>
              )}

              {/* Role */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  System Role & Permissions
                </span>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {roleName}
                </p>
              </div>

              {/* Joined Date */}
              <div className="space-y-1">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Date Joined
                </span>
                <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {employeeDetail?.joinedDate ? formatDate(employeeDetail.joinedDate) : 'Not recorded'}
                </p>
              </div>
            </div>

            {/* Read-only notification banner */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 flex items-start gap-3">
              <Info className="h-5 w-5 text-neutral-500 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
                <span className="font-semibold text-neutral-900 dark:text-neutral-200">
                  Need to update your job or contact details?
                </span>
                <p>
                  Official employment attributes, role assignments, and department affiliations are managed by your HR Administrator. Contact HR to request modifications.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Tab 2: Security (Change Password) ─────────────────────── */}
      {activeTab === 'security' && (
        <div className="card p-6 md:p-8 space-y-6 max-w-2xl">
          <div className="space-y-1 border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Change Account Password
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Ensure your account stays secure by using a strong password with letters, numbers, and symbols.
            </p>
          </div>

          {passwordError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Current Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="input input-md pr-10 text-xs sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  tabIndex={-1}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new strong password"
                  required
                  className="input input-md pr-10 text-xs sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Strength Meter Bar */}
              {newPassword && (
                <div className="space-y-1.5 pt-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">
                      Strength:
                    </span>
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-[11px]">
                      {strength.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 h-1.5 w-full">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={cn(
                          'h-full rounded-full transition-all duration-300',
                          strength.score >= step
                            ? strength.color
                            : 'bg-neutral-200 dark:bg-neutral-800'
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="input input-md pr-10 text-xs sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Rule Hints Checklist */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 block">
                Password Requirements:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div
                  className={cn(
                    'flex items-center gap-2',
                    checklist.hasMinLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'
                  )}
                >
                  {checklist.hasMinLength ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-neutral-300 dark:border-neutral-600" />
                  )}
                  <span>At least 8 characters</span>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-2',
                    checklist.hasUpper ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'
                  )}
                >
                  {checklist.hasUpper ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-neutral-300 dark:border-neutral-600" />
                  )}
                  <span>One uppercase letter (A-Z)</span>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-2',
                    checklist.hasLower ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'
                  )}
                >
                  {checklist.hasLower ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-neutral-300 dark:border-neutral-600" />
                  )}
                  <span>One lowercase letter (a-z)</span>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-2',
                    checklist.hasDigit ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'
                  )}
                >
                  {checklist.hasDigit ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-neutral-300 dark:border-neutral-600" />
                  )}
                  <span>One numeric digit (0-9)</span>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-2',
                    checklist.hasSpecial ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'
                  )}
                >
                  {checklist.hasSpecial ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-neutral-300 dark:border-neutral-600" />
                  )}
                  <span>One special character (!@#$)</span>
                </div>

                <div
                  className={cn(
                    'flex items-center gap-2',
                    checklist.matchesConfirm ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'
                  )}
                >
                  {checklist.matchesConfirm ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-neutral-300 dark:border-neutral-600" />
                  )}
                  <span>Passwords match</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={changePasswordMutation.isPending || !isFormValid}
                className="btn btn-primary btn-md inline-flex items-center gap-2 font-semibold shadow-sm"
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 6. Tab 3: Preferences (Theme: Light / Dark / System) ────── */}
      {activeTab === 'preferences' && (
        <div className="card p-6 md:p-8 space-y-6 max-w-2xl">
          <div className="space-y-1 border-b border-neutral-100 dark:border-neutral-800 pb-4">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Appearance & Theme
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Customize how TeamTime HR looks on your device. Changes are saved and applied immediately.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Light Option */}
            <button
              type="button"
              onClick={() => handleThemeChange('light')}
              className={cn(
                'p-5 rounded-2xl border text-left transition-all relative flex flex-col justify-between space-y-4 group hover:shadow-md',
                theme === 'light'
                  ? 'border-primary-500 ring-2 ring-primary-500/30 bg-primary-50/20 dark:bg-primary-950/20'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
                  <Sun className="h-5 w-5" />
                </div>
                {theme === 'light' && (
                  <span className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-xs">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 block">
                  Light Theme
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Clean bright appearance with high contrast for daytime clarity.
                </p>
              </div>
            </button>

            {/* Dark Option */}
            <button
              type="button"
              onClick={() => handleThemeChange('dark')}
              className={cn(
                'p-5 rounded-2xl border text-left transition-all relative flex flex-col justify-between space-y-4 group hover:shadow-md',
                theme === 'dark'
                  ? 'border-primary-500 ring-2 ring-primary-500/30 bg-primary-50/20 dark:bg-primary-950/20'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center">
                  <Moon className="h-5 w-5" />
                </div>
                {theme === 'dark' && (
                  <span className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-xs">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 block">
                  Dark Theme
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Deep modern slate styling that is gentle on your eyes in low-light.
                </p>
              </div>
            </button>

            {/* System Option */}
            <button
              type="button"
              onClick={() => handleThemeChange('system')}
              className={cn(
                'p-5 rounded-2xl border text-left transition-all relative flex flex-col justify-between space-y-4 group hover:shadow-md',
                theme === 'system'
                  ? 'border-primary-500 ring-2 ring-primary-500/30 bg-primary-50/20 dark:bg-primary-950/20'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900'
              )}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 flex items-center justify-center">
                  <Laptop className="h-5 w-5" />
                </div>
                {theme === 'system' && (
                  <span className="w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-xs">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 block">
                  System Sync
                </span>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Follows your operating system's dark/light schedule automatically.
                </p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
