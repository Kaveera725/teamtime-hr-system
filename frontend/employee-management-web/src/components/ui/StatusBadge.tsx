import {
  CheckCircle2, Clock, Cloud, XCircle, AlertCircle, Ban,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AttendanceStatus, LeaveStatus } from '@/types/api';

// ── Attendance ────────────────────────────────────────────
const ATTENDANCE_CONFIG: Record<
  AttendanceStatus,
  { label: string; icon: LucideIcon; cls: string }
> = {
  PRESENT:  { label: 'Present',   icon: CheckCircle2,   cls: 'badge-present' },
  LATE:     { label: 'Late',      icon: Clock,          cls: 'badge-late' },
  HALF_DAY: { label: 'Half Day',  icon: Cloud,          cls: 'badge-half_day' },
  ABSENT:   { label: 'Absent',    icon: XCircle,        cls: 'badge-absent' },
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
  status: AttendanceStatus;
  className?: string;
}

interface LeaveBadgeProps {
  status: LeaveStatus;
  className?: string;
}

export function AttendanceBadge({ status, className }: AttendanceBadgeProps) {
  const cfg = ATTENDANCE_CONFIG[status] ?? {
    label: status,
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
