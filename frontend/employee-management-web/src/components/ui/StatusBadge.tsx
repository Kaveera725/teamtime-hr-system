import {
  CheckCircle2, Clock, Cloud, XCircle, AlertCircle, Ban, Calendar, Coffee, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AttendanceStatus, LeaveStatus } from '@/types/api';

// ── Attendance ────────────────────────────────────────────
const ATTENDANCE_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon; cls: string }
> = {
  PRESENT:   { label: 'Present',   icon: CheckCircle2, cls: 'badge-present' },
  LATE:      { label: 'Late',      icon: Clock,        cls: 'badge-late' },
  HALF_DAY:  { label: 'Half Day',  icon: Cloud,        cls: 'badge-half_day' },
  ABSENT:    { label: 'Absent',    icon: XCircle,      cls: 'badge-absent' },
  ON_LEAVE:  { label: 'On Leave',  icon: Calendar,     cls: 'badge-on_leave' },
  WEEKEND:   { label: 'Weekend',   icon: Coffee,       cls: 'badge-weekend' },
};

// ── Leave ─────────────────────────────────────────────────
const LEAVE_CONFIG: Record<
  LeaveStatus,
  { label: string; icon: LucideIcon; cls: string }
> = {
  PENDING:   { label: 'Pending',   icon: Clock,         cls: 'badge-pending' },
  APPROVED:  { label: 'Approved',  icon: CheckCircle2,  cls: 'badge-approved' },
  REJECTED:  { label: 'Rejected',  icon: XCircle,       cls: 'badge-rejected' },
  CANCELLED: { label: 'Cancelled', icon: Ban,           cls: 'badge-cancelled' },
};

interface AttendanceBadgeProps {
  status: AttendanceStatus | string;
  className?: string;
}

interface LeaveBadgeProps {
  status: LeaveStatus;
  className?: string;
}

export function AttendanceBadge({ status, className }: AttendanceBadgeProps) {
  const normalizedKey = (status || '').toUpperCase();
  const cfg = ATTENDANCE_CONFIG[normalizedKey] ?? {
    label: status || 'Unknown',
    icon: AlertCircle,
    cls: 'badge-absent',
  };
  const Icon = cfg.icon;
  return (
    <span className={cn('badge', cfg.cls, className)}>
      <Icon size={12} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

export function MissingCheckOutBadge({ className, showLabel = true }: { className?: string; showLabel?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
        className
      )}
      title="Missing check-out: Employee clocked in but did not record a check-out before the end of the day."
    >
      <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
      {showLabel && <span>Missing Check-out</span>}
    </span>
  );
}

export function LeaveBadge({ status, className }: LeaveBadgeProps) {
  const cfg = LEAVE_CONFIG[status] ?? {
    label: status,
    icon: AlertCircle,
    cls: 'badge-pending',
  };
  const Icon = cfg.icon;
  return (
    <span className={cn('badge', cfg.cls, className)}>
      <Icon size={12} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
