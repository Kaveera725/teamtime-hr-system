import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Users,
  AlertTriangle,
  Building2,
  X,
  Filter,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isWeekend,
  isSameMonth,
} from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/utils';
import type {
  DepartmentDto,
  LeaveRequestDto,
  PagedResult,
  LeaveTypeDto,
} from '@/types/api';

interface TeamLeaveCalendarProps {
  onSelectRequest?: (request: LeaveRequestDto) => void;
  selectedRequestId?: number | null;
  onApproveRequest?: (request: LeaveRequestDto) => void;
  onRejectRequest?: (request: LeaveRequestDto) => void;
}

// Color palette for leave types
const LEAVE_TYPE_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  annual: { bg: 'bg-indigo-600', text: 'text-white', hex: '#4f46e5' },
  casual: { bg: 'bg-amber-600', text: 'text-white', hex: '#d97706' },
  medical: { bg: 'bg-rose-600', text: 'text-white', hex: '#e11d48' },
  sick: { bg: 'bg-rose-600', text: 'text-white', hex: '#e11d48' },
  maternity: { bg: 'bg-purple-600', text: 'text-white', hex: '#9333ea' },
  paternity: { bg: 'bg-purple-600', text: 'text-white', hex: '#9333ea' },
  unpaid: { bg: 'bg-slate-600', text: 'text-white', hex: '#475569' },
  'no pay': { bg: 'bg-slate-600', text: 'text-white', hex: '#475569' },
  default: { bg: 'bg-teal-600', text: 'text-white', hex: '#0d9488' },
};

export function getLeaveTypeTheme(typeName: string) {
  const lower = (typeName || '').toLowerCase();
  for (const [key, theme] of Object.entries(LEAVE_TYPE_COLORS)) {
    if (lower.includes(key)) return theme;
  }
  return LEAVE_TYPE_COLORS.default;
}

export const TeamLeaveCalendar: React.FC<TeamLeaveCalendarProps> = ({
  onSelectRequest,
  selectedRequestId,
  onApproveRequest,
  onRejectRequest,
}) => {
  const { user, isAdmin } = useAuth();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('ALL');
  const [activeDayDetail, setActiveDayDetail] = useState<Date | null>(null);

  // Month interval + calendar grid boundary
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // 1. Fetch departments (for Admin department filter)
  const { data: departments = [] } = useQuery<DepartmentDto[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get<DepartmentDto[]>('/departments');
      return res.data;
    },
    enabled: isAdmin,
  });

  // 2. Fetch team size / total active employees in department or company
  const { data: employeesData } = useQuery<PagedResult<any>>({
    queryKey: ['calendarTeamSize', selectedDepartmentId],
    queryFn: async () => {
      const params: Record<string, any> = { pageSize: 1 };
      if (selectedDepartmentId !== 'ALL') {
        params.departmentId = selectedDepartmentId;
      }
      const res = await api.get<PagedResult<any>>('/employees', { params });
      return res.data;
    },
  });

  const totalTeamSize = useMemo(() => {
    if (employeesData?.totalCount && employeesData.totalCount > 0) {
      return employeesData.totalCount;
    }
    if (selectedDepartmentId !== 'ALL') {
      const dept = departments.find((d) => String(d.id) === selectedDepartmentId);
      if (dept?.employeeCount) return dept.employeeCount;
    }
    return 8; // Sensible baseline fallback
  }, [employeesData, selectedDepartmentId, departments]);

  // 3. Fetch leave types for legend
  const { data: leaveTypes = [] } = useQuery<LeaveTypeDto[]>({
    queryKey: ['leaveTypes'],
    queryFn: async () => {
      const res = await api.get<LeaveTypeDto[]>('/leave-types');
      return res.data;
    },
  });

  // 4. Fetch leave requests in current month view range
  const fromDateStr = format(calendarStart, 'yyyy-MM-dd');
  const toDateStr = format(calendarEnd, 'yyyy-MM-dd');

  const { data: leaveRequestsData } = useQuery<PagedResult<LeaveRequestDto>>({
    queryKey: ['teamLeaveCalendar', fromDateStr, toDateStr, selectedDepartmentId],
    queryFn: async () => {
      const params: Record<string, any> = {
        from: fromDateStr,
        to: toDateStr,
        pageSize: 500, // retrieve all leaves intersecting this calendar month
      };
      if (selectedDepartmentId !== 'ALL') {
        params.departmentId = selectedDepartmentId;
      }
      const res = await api.get<PagedResult<LeaveRequestDto>>('/leave-requests', { params });
      return res.data;
    },
  });

  const leaveRequests = useMemo(() => {
    const items = leaveRequestsData?.items ?? [];
    // Only show APPROVED or PENDING leaves on the calendar
    return items.filter((lr) => lr.status === 'APPROVED' || lr.status === 'PENDING');
  }, [leaveRequestsData]);

  // Build daily lookup map
  const dailyLeavesMap = useMemo(() => {
    const map = new Map<string, LeaveRequestDto[]>();

    for (const day of calendarDays) {
      const dayKey = format(day, 'yyyy-MM-dd');
      const matches = leaveRequests.filter((lr) => {
        return lr.startDate <= dayKey && dayKey <= lr.endDate;
      });
      map.set(dayKey, matches);
    }

    return map;
  }, [calendarDays, leaveRequests]);

  const handlePrevMonth = () => setCurrentDate((d) => subMonths(d, 1));
  const handleNextMonth = () => setCurrentDate((d) => addMonths(d, 1));
  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setActiveDayDetail(today);
  };

  // Day detail modal info
  const selectedDayKey = activeDayDetail ? format(activeDayDetail, 'yyyy-MM-dd') : null;
  const dayLeaves = selectedDayKey ? (dailyLeavesMap.get(selectedDayKey) ?? []) : [];
  const dayUniqueOffCount = useMemo(() => {
    const empIds = new Set(dayLeaves.map((l) => l.employeeId));
    return empIds.size;
  }, [dayLeaves]);

  return (
    <div className="space-y-4">
      {/* Calendar Header Controls */}
      <div className="card p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700 transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="px-3 text-sm sm:text-base font-bold text-neutral-900 dark:text-neutral-100 min-w-[150px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-700 transition-colors"
              title="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="btn btn-secondary btn-sm text-xs font-semibold px-3 py-1.5"
          >
            Today
          </button>
        </div>

        {/* Right side: Department Filter & Legend */}
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-neutral-400" />
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="input input-sm py-1 px-3 text-xs rounded-lg border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
              >
                <option value="ALL">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={String(dept.id)}>
                    {dept.name} ({dept.employeeCount} team members)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
              <Building2 className="h-3.5 w-3.5 text-primary-500" />
              <span>Team Roster ({totalTeamSize} members)</span>
            </div>
          )}

          {/* Quick Legend Indicator */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-800/80 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded bg-indigo-600" />
              <span>Solid = Approved</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-5 rounded border border-indigo-500"
                style={{
                  background:
                    'repeating-linear-gradient(45deg, #4f46e5, #4f46e5 3px, rgba(255,255,255,0.4) 3px, rgba(255,255,255,0.4) 6px)',
                }}
              />
              <span>Striped = Pending</span>
            </span>
          </div>
        </div>
      </div>

      {/* Leave Type Color Badges Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-neutral-600 dark:text-neutral-400">
        <span className="font-semibold text-neutral-700 dark:text-neutral-300 shrink-0">Types:</span>
        {leaveTypes.map((type) => {
          const theme = getLeaveTypeTheme(type.name);
          return (
            <span
              key={type.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shrink-0 shadow-2xs"
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.hex }} />
              <span className="text-[11px] font-medium">{type.name}</span>
            </span>
          );
        })}
      </div>

      {/* Month Calendar Grid */}
      <div className="card overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm">
        {/* Weekday Header */}
        <div className="grid grid-cols-7 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-800/60 text-center text-xs font-semibold text-neutral-600 dark:text-neutral-400 py-2.5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-neutral-200 dark:divide-neutral-800">
          {calendarDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const leaves = dailyLeavesMap.get(dayKey) ?? [];
            const dayIsToday = isToday(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const dayIsWeekend = isWeekend(day);

            // Calculate unique people off for coverage hint
            const uniqueEmpIds = new Set(leaves.map((l) => l.employeeId));
            const countOff = uniqueEmpIds.size;
            // Many people away: e.g. 2 or more, or >= 25% of team
            const isHighAbsence = countOff >= 2 || (totalTeamSize > 0 && countOff / totalTeamSize >= 0.25);

            return (
              <div
                key={dayKey}
                onClick={() => setActiveDayDetail(day)}
                className={`min-h-[105px] sm:min-h-[120px] p-1.5 sm:p-2 flex flex-col justify-between transition-colors cursor-pointer select-none group hover:bg-primary-50/40 dark:hover:bg-primary-950/20 ${
                  !isCurrentMonth
                    ? 'bg-neutral-50/50 dark:bg-neutral-900/40 text-neutral-400'
                    : dayIsWeekend
                    ? 'bg-neutral-50/30 dark:bg-neutral-800/30'
                    : 'bg-white dark:bg-neutral-900'
                }`}
              >
                {/* Cell Header: Day Number & Coverage Hint */}
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span
                    className={`inline-flex items-center justify-center text-xs font-semibold rounded-full ${
                      dayIsToday
                        ? 'h-6 w-6 bg-primary-600 text-white shadow-xs'
                        : isCurrentMonth
                        ? 'text-neutral-900 dark:text-neutral-100 group-hover:text-primary-600 dark:group-hover:text-primary-400'
                        : 'text-neutral-400 dark:text-neutral-600'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>

                  {/* Coverage Hint */}
                  {countOff > 0 && (
                    <span
                      title={`${countOff} of ${totalTeamSize} team members away on this day`}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-tight shadow-2xs ${
                        isHighAbsence
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300 ring-1 ring-rose-500/30'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {isHighAbsence && <AlertTriangle className="h-2.5 w-2.5 shrink-0" />}
                      <span>
                        {countOff} of {totalTeamSize} off
                      </span>
                    </span>
                  )}
                </div>

                {/* Leave Bars List */}
                <div className="space-y-1 flex-1 overflow-hidden mt-0.5">
                  {leaves.slice(0, 3).map((lr) => {
                    const theme = getLeaveTypeTheme(lr.leaveTypeName);
                    const isPending = lr.status === 'PENDING';
                    const isSelected = selectedRequestId === lr.id;

                    return (
                      <div
                        key={lr.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectRequest) {
                            onSelectRequest(lr);
                          } else {
                            setActiveDayDetail(day);
                          }
                        }}
                        title={`${lr.employeeName} · ${lr.leaveTypeName} (${lr.status})`}
                        style={
                          isPending
                            ? {
                                background: `repeating-linear-gradient(45deg, ${theme.hex}, ${theme.hex} 5px, rgba(255,255,255,0.3) 5px, rgba(255,255,255,0.3) 10px)`,
                              }
                            : { backgroundColor: theme.hex }
                        }
                        className={`px-1.5 py-0.5 rounded text-[11px] font-medium text-white truncate shadow-2xs transition-all flex items-center justify-between gap-1 ${
                          isSelected ? 'ring-2 ring-primary-500 ring-offset-1 scale-[1.02]' : 'hover:opacity-90'
                        } ${isPending ? 'border border-dashed border-white/40' : ''}`}
                      >
                        <span className="truncate leading-tight">{lr.employeeName}</span>
                        {isPending && (
                          <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-black/40 text-amber-200 font-bold shrink-0">
                            P
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {leaves.length > 3 && (
                    <div className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 pl-1">
                      +{leaves.length - 3} more off
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Details Tap/Hover Modal Drawer */}
      {activeDayDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg card p-5 sm:p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                    {format(activeDayDetail, 'EEEE, MMMM d, yyyy')}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      Team Coverage:
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        dayUniqueOffCount >= 2
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {dayUniqueOffCount} of {totalTeamSize} off on this day
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDayDetail(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* List of Leaves on This Day */}
            <div className="my-4 overflow-y-auto space-y-3 pr-1 flex-1">
              {dayLeaves.length === 0 ? (
                <div className="py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                  <Users className="h-8 w-8 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
                  Full team attendance. No members on leave on this date.
                </div>
              ) : (
                dayLeaves.map((req) => {
                  const theme = getLeaveTypeTheme(req.leaveTypeName);
                  const isPending = req.status === 'PENDING';
                  const isOwnRequest = Number(user?.employeeId) === Number(req.employeeId);

                  return (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 space-y-2 hover:border-neutral-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={req.employeeName} size="sm" />
                          <div>
                            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                              {req.employeeName}
                            </div>
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                              {req.departmentName || 'Team'} · {req.employeeCode}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-1.5">
                          <span
                            style={
                              isPending
                                ? {
                                    background: `repeating-linear-gradient(45deg, ${theme.hex}, ${theme.hex} 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 8px)`,
                                  }
                                : { backgroundColor: theme.hex }
                            }
                            className="px-2 py-0.5 rounded text-[11px] font-semibold text-white shadow-2xs"
                          >
                            {req.leaveTypeName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isPending
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                      </div>

                      {/* Details row */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 dark:text-neutral-300 pt-1">
                        <div>
                          <span className="text-neutral-400">Dates: </span>
                          <span className="font-medium">
                            {formatDate(req.startDate)} – {formatDate(req.endDate)}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-400">Duration: </span>
                          <span className="font-semibold text-neutral-900 dark:text-white">
                            {req.totalDays} {req.totalDays === 1 ? 'day' : 'days'}
                          </span>
                        </div>
                      </div>

                      {req.reason && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 italic bg-white dark:bg-neutral-800 p-2 rounded-lg border border-neutral-100 dark:border-neutral-700">
                          "{req.reason}"
                        </p>
                      )}

                      {/* Inline Decision Actions for Pending Requests */}
                      {isPending && onApproveRequest && onRejectRequest && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200/80 dark:border-neutral-700/60">
                          {isOwnRequest && !isAdmin ? (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                              Your request (requires admin approval)
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveDayDetail(null);
                                  onRejectRequest(req);
                                }}
                                className="btn btn-secondary btn-sm text-xs text-rose-600 hover:text-rose-700"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveDayDetail(null);
                                  onApproveRequest(req);
                                }}
                                className="btn btn-primary btn-sm text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                Approve
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActiveDayDetail(null)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
