import React from 'react';
import { Calendar, Clock, CheckCircle2, LogIn, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { LeaveBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { formatDate, formatTime } from '@/lib/utils';
import type {
  EmployeeDashboardDto,
  LeaveBalanceDtoFull,
  DashboardLeaveRequestItemDto,
} from '@/types/dashboard';

// ── Leave Balance Ring ─────────────────────────────────────
const RING_SIZE = 96;
const STROKE = 8;
const R = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

const leaveTypeColors: Record<string, { stroke: string; text: string }> = {
  default: { stroke: '#6366f1', text: 'text-primary-600 dark:text-primary-400' },
  annual:  { stroke: '#10b981', text: 'text-emerald-600 dark:text-emerald-400' },
  sick:    { stroke: '#f43f5e', text: 'text-rose-600 dark:text-rose-400' },
  casual:  { stroke: '#f59e0b', text: 'text-amber-600 dark:text-amber-400' },
  maternity: { stroke: '#8b5cf6', text: 'text-violet-600 dark:text-violet-400' },
  'no pay': { stroke: '#64748b', text: 'text-slate-600 dark:text-slate-400' },
};

function getLeaveColor(typeName: string) {
  const lower = typeName.toLowerCase();
  for (const key of Object.keys(leaveTypeColors)) {
    if (lower.includes(key)) return leaveTypeColors[key];
  }
  return leaveTypeColors.default;
}

interface LeaveBalanceRingProps {
  balance: LeaveBalanceDtoFull;
}

function LeaveBalanceRing({ balance }: LeaveBalanceRingProps) {
  const pct = balance.allocatedDays > 0
    ? Math.min(balance.remainingDays / balance.allocatedDays, 1)
    : 0;
  const dashOffset = CIRCUMFERENCE * (1 - pct);
  const color = getLeaveColor(balance.leaveTypeName);

  return (
    <div className="card p-4 flex flex-col items-center gap-2 text-center hover:shadow-md transition-shadow">
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        {/* Track */}
        <svg width={RING_SIZE} height={RING_SIZE} className="rotate-[-90deg]">
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={R}
            stroke="currentColor"
            strokeWidth={STROKE}
            fill="none"
            className="text-neutral-200 dark:text-neutral-800"
          />
          {/* Progress */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={R}
            stroke={color.stroke}
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-extrabold leading-none ${color.text}`}>
            {balance.remainingDays}
          </span>
          <span className="text-[9px] text-neutral-400 font-medium">
            / {balance.allocatedDays}
          </span>
        </div>
      </div>
      <div className="space-y-0.5">
        <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
          {balance.leaveTypeName}
        </div>
        <div className="text-[10px] text-neutral-400">
          {balance.usedDays} used · {balance.pendingDays} pending
        </div>
      </div>
    </div>
  );
}

// ── Today Attendance Card ──────────────────────────────────
interface TodayCardProps {
  data: EmployeeDashboardDto;
}

function TodayAttendanceCard({ data }: TodayCardProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const att = data.todayAttendance;

  const checkInMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-in'),
    onSuccess: () => {
      toast.success('Checked in successfully!');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const checkOutMutation = useMutation({
    mutationFn: () => api.post('/attendance/check-out'),
    onSuccess: () => {
      toast.success('Checked out successfully!');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const stateConfig = {
    NOT_CHECKED_IN: {
      icon: <LogIn className="h-5 w-5 text-neutral-400" />,
      label: 'Not Yet Checked In',
      sub: att.isWorkingDay ? 'Working day — click to check in.' : 'Non-working day.',
      accent: 'text-neutral-500 dark:text-neutral-400',
    },
    CHECKED_IN: {
      icon: <Clock className="h-5 w-5 text-amber-500" />,
      label: 'Currently Working',
      sub: att.attendance?.checkIn
        ? `Checked in at ${formatTime(att.attendance.checkIn)}`
        : 'Active session.',
      accent: 'text-amber-600 dark:text-amber-400',
    },
    CHECKED_OUT: {
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
      label: 'Day Complete',
      sub: att.attendance?.workedHours != null
        ? `Worked ${att.attendance.workedHours.toFixed(1)}h today`
        : 'Checked out.',
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
  };

  const cfg = stateConfig[att.state];

  return (
    <div className="card p-5 border-l-4 border-l-primary-500 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
          {cfg.icon}
        </div>
        <div>
          <div className={`text-base font-semibold ${cfg.accent}`}>{cfg.label}</div>
          <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{cfg.sub}</div>
          {att.attendance?.checkIn && att.attendance?.checkOut && (
            <div className="text-xs text-neutral-400 mt-1">
              {formatTime(att.attendance.checkIn)} → {formatTime(att.attendance.checkOut)}
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-2 sm:flex-shrink-0">
        {att.state === 'NOT_CHECKED_IN' && att.canCheckIn && (
          <button
            onClick={() => checkInMutation.mutate()}
            disabled={checkInMutation.isPending}
            className="btn btn-primary btn-md"
          >
            <LogIn className="h-4 w-4" />
            Check In
          </button>
        )}
        {att.state === 'CHECKED_IN' && att.canCheckOut && (
          <button
            onClick={() => checkOutMutation.mutate()}
            disabled={checkOutMutation.isPending}
            className="btn btn-md bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Clock className="h-4 w-4" />
            Check Out
          </button>
        )}
        {att.state === 'CHECKED_OUT' && (
          <button onClick={() => navigate('/attendance')} className="btn btn-secondary btn-sm">
            View Log
          </button>
        )}
      </div>
    </div>
  );
}

// ── Leave Request Row ──────────────────────────────────────
function LeaveRequestRow({ req }: { req: DashboardLeaveRequestItemDto }) {
  const status = req.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  return (
    <div className="flex items-center justify-between py-3 border-b border-neutral-100 dark:border-neutral-800 last:border-0 gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
          {req.leaveTypeName}
        </div>
        <div className="text-xs text-neutral-400 mt-0.5">
          {formatDate(req.startDate)} — {formatDate(req.endDate)} ({req.totalDays}d)
        </div>
      </div>
      <LeaveBadge status={status} />
    </div>
  );
}

// ── Employee Dashboard ─────────────────────────────────────
interface Props {
  data: EmployeeDashboardDto;
  isLoading: boolean;
}

export const EmployeeDashboardView: React.FC<Props> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton className="h-48" />
          <CardSkeleton className="h-48" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Today Attendance */}
      <TodayAttendanceCard data={data} />

      {/* Leave Balance Rings */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Leave Balances · {new Date().getFullYear()}
          </h2>
          <Link to="/leave" className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
            Apply <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {data.leaveBalances.length === 0 ? (
          <EmptyState title="No leave balances" description="Leave balances for the current year have not been generated yet." icon={Calendar} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {data.leaveBalances.map(b => <LeaveBalanceRing key={b.id} balance={b} />)}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leave Requests */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Recent Requests</h2>
            <Link to="/leave" className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
              View all
            </Link>
          </div>
          {data.last5LeaveRequests.length === 0 ? (
            <EmptyState title="No requests yet" description="Your leave history will appear here." icon={Calendar} className="py-6 border-0 shadow-none bg-transparent" />
          ) : (
            <div>
              {data.last5LeaveRequests.map(req => <LeaveRequestRow key={req.id} req={req} />)}
            </div>
          )}
        </div>

        {/* Upcoming Approved Leave */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Upcoming Leave</h2>
            <span className="badge badge-approved">{data.upcomingApprovedLeave.length} approved</span>
          </div>
          {data.upcomingApprovedLeave.length === 0 ? (
            <EmptyState title="No upcoming leave" description="Approved future leave will be listed here." icon={Calendar} className="py-6 border-0 shadow-none bg-transparent" />
          ) : (
            <div className="space-y-3">
              {data.upcomingApprovedLeave.map(req => (
                <div key={req.id} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{req.leaveTypeName}</div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatDate(req.startDate)} — {formatDate(req.endDate)} · {req.totalDays}d
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
