import React, { useState } from 'react';
import { Clock, CheckCircle2, XCircle, CalendarOff, ChevronRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { FormField } from '@/components/ui/FormField';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type {
  ManagerDashboardDto,
  DashboardPendingApprovalDto,
} from '@/types/dashboard';

// ── Inline Approve/Reject ──────────────────────────────────
interface ApprovalCardProps {
  req: DashboardPendingApprovalDto;
  onDone: () => void;
}

function ApprovalCard({ req, onDone }: ApprovalCardProps) {
  const queryClient = useQueryClient();
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const approveMutation = useMutation({
    mutationFn: () => api.put(`/leave-requests/${req.id}/approve`),
    onSuccess: () => {
      toast.success(`Approved ${req.employeeName}'s leave`);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      onDone();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.put(`/leave-requests/${req.id}/reject`, { rejectionReason: rejectReason }),
    onSuccess: () => {
      toast.success(`Rejected ${req.employeeName}'s leave`);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowReject(false);
      onDone();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleReject = () => {
    if (!rejectReason.trim()) {
      setRejectError('Rejection reason is required.');
      return;
    }
    rejectMutation.mutate();
  };

  return (
    <div className="card p-4 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
      <div className="flex items-start gap-3">
        <Avatar name={req.employeeName} size="sm" className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {req.employeeName}
              </div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {req.leaveTypeName} · {req.totalDays}d
              </div>
            </div>
            <div className="text-xs text-neutral-400 flex-shrink-0">
              {formatDate(req.startDate)} — {formatDate(req.endDate)}
            </div>
          </div>
          {req.reason && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 line-clamp-2 italic">
              "{req.reason}"
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white flex-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </button>
            <button
              onClick={() => setShowReject(true)}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="btn btn-sm bg-rose-600 hover:bg-rose-700 text-white flex-1"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        </div>
      </div>

      {/* Inline rejection form */}
      {showReject && (
        <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
          <FormField
            label="Rejection Reason"
            htmlFor={`reject-reason-${req.id}`}
            required
            error={rejectError}
          >
            <textarea
              id={`reject-reason-${req.id}`}
              rows={2}
              placeholder="Enter reason for rejection..."
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (e.target.value.trim()) setRejectError('');
              }}
              className="input text-xs resize-none"
            />
          </FormField>
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              className="btn btn-sm btn-danger flex-1"
            >
              {rejectMutation.isPending ? 'Submitting...' : 'Confirm Rejection'}
            </button>
            <button
              onClick={() => { setShowReject(false); setRejectReason(''); setRejectError(''); }}
              className="btn btn-sm btn-ghost"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Team Status Group ──────────────────────────────────────
interface AvatarGroupProps {
  label: string;
  count: number;
  names: string[];
  dotColor: string;
  emptyText: string;
}

function AvatarGroup({ label, count, names, dotColor, emptyText }: AvatarGroupProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full flex-shrink-0', dotColor)} />
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
        <span className="ml-auto text-xs font-bold text-neutral-700 dark:text-neutral-300">
          {count}
        </span>
      </div>
      {names.length === 0 ? (
        <p className="text-xs text-neutral-400 pl-4">{emptyText}</p>
      ) : (
        <div className="flex flex-wrap gap-2 pl-4">
          {names.slice(0, 8).map((name) => (
            <div key={name} className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full pl-1 pr-2.5 py-1">
              <Avatar name={name} size="xs" />
              <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">{name.split(' ')[0]}</span>
            </div>
          ))}
          {names.length > 8 && (
            <span className="text-xs text-neutral-400 self-center">+{names.length - 8} more</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Manager Dashboard ──────────────────────────────────────
interface Props {
  data: ManagerDashboardDto;
  isLoading: boolean;
}

export const ManagerDashboardView: React.FC<Props> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton className="h-64" />
          <CardSkeleton className="h-64" />
        </div>
      </div>
    );
  }

  const { teamStatusToday: team } = data;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Pending Approvals" value={data.pendingApprovalsCount} icon={Clock} accent="warning" />
        <StatCard label="Present" value={team.presentCount} icon={CheckCircle2} accent="success" />
        <StatCard label="On Leave" value={team.onLeaveCount} icon={CalendarOff} accent="info" />
        <StatCard label="Total Team" value={team.totalTeamMembers} icon={Users} accent="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals with inline actions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
              Pending Approvals
              {data.pendingApprovalsCount > 0 && (
                <span className="ml-2 text-xs font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                  {data.pendingApprovalsCount}
                </span>
              )}
            </h2>
            <Link to="/leave" className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              All <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {data.pendingApprovals.length === 0 ? (
            <EmptyState
              title="No pending approvals"
              description="All leave requests have been processed."
              icon={CheckCircle2}
              className="py-6 border-0 shadow-none bg-transparent"
            />
          ) : (
            <div className="space-y-3">
              {data.pendingApprovals.slice(0, 5).map(req => (
                <ApprovalCard key={req.id} req={req} onDone={() => {}} />
              ))}
              {data.pendingApprovals.length > 5 && (
                <Link to="/leave" className="flex items-center justify-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline py-2">
                  View {data.pendingApprovals.length - 5} more pending
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Team Today Panel */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
              Team Today — {data.departmentName || 'Your Department'}
            </h2>
            <div className="space-y-4">
              <AvatarGroup
                label="Present"
                count={team.presentCount}
                names={team.present.map(m => m.employeeName)}
                dotColor="bg-emerald-500"
                emptyText="No one checked in yet."
              />
              <AvatarGroup
                label="Late"
                count={team.lateCount}
                names={team.late.map(m => m.employeeName)}
                dotColor="bg-amber-500"
                emptyText="No late arrivals."
              />
              <AvatarGroup
                label="On Leave"
                count={team.onLeaveCount}
                names={team.onLeave.map(m => m.employeeName)}
                dotColor="bg-sky-500"
                emptyText="No one on leave today."
              />
              <AvatarGroup
                label="Absent"
                count={team.absentCount}
                names={team.absent.map(m => m.employeeName)}
                dotColor="bg-rose-500"
                emptyText="No absences."
              />
            </div>
          </div>

          {/* On Leave This Week */}
          <div className="card p-5">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
              Off This Week
            </h2>
            {data.teamMembersOnLeaveThisWeek.length === 0 ? (
              <p className="text-sm text-neutral-400">No team members on leave this week.</p>
            ) : (
              <div className="space-y-2">
                {data.teamMembersOnLeaveThisWeek.map(m => (
                  <div key={m.employeeId} className="flex items-center gap-2.5 py-1.5">
                    <Avatar name={m.employeeName} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">{m.employeeName}</div>
                      <div className="text-[10px] text-neutral-400">{m.leaveTypeName} · {formatDate(m.startDate)} – {formatDate(m.endDate)}</div>
                    </div>
                    <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 flex-shrink-0">{m.totalDays}d</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
