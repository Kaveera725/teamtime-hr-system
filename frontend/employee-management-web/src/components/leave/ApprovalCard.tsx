import React from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  ShieldAlert,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate, formatWaitingTime } from '@/lib/utils';
import { getLeaveTypeTheme } from './TeamLeaveCalendar';
import { WhoElseIsAwayBadge } from './WhoElseIsAwayBadge';
import { useAuth } from '@/contexts/AuthContext';
import type { LeaveRequestDto } from '@/types/api';

interface ApprovalCardProps {
  request: LeaveRequestDto;
  allTeamLeaves: LeaveRequestDto[];
  viewMode?: 'cards' | 'rows';
  isApproving: boolean;
  onApprove: (request: LeaveRequestDto) => void;
  onReject: (request: LeaveRequestDto) => void;
  onViewCalendar?: () => void;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({
  request,
  allTeamLeaves,
  viewMode = 'cards',
  isApproving,
  onApprove,
  onReject,
  onViewCalendar,
}) => {
  const { user, isAdmin } = useAuth();
  const theme = getLeaveTypeTheme(request.leaveTypeName);
  const isPending = request.status === 'PENDING';
  const isApproved = request.status === 'APPROVED';
  const isRejected = request.status === 'REJECTED';

  // Check if current user is the requester (manager's own request)
  const isOwnRequest = Number(user?.employeeId) === Number(request.employeeId);

  // Remaining balance display
  const balanceDisplay =
    request.remainingBalance !== undefined && request.remainingBalance !== null
      ? `${request.remainingBalance}d remaining`
      : null;

  if (viewMode === 'rows') {
    return (
      <div className="card p-4 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Employee & Leave Basics */}
          <div className="flex items-start gap-3.5 min-w-0">
            <Avatar name={request.employeeName} size="md" className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
                  {request.employeeName}
                </span>
                <span className="text-xs text-neutral-400">({request.employeeCode})</span>
                {request.departmentName && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
                    {request.departmentName}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex-wrap">
                <span
                  style={{ backgroundColor: theme.hex }}
                  className="px-2 py-0.5 rounded text-[11px] font-semibold text-white shadow-2xs"
                >
                  {request.leaveTypeName}
                </span>
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {formatDate(request.startDate)} – {formatDate(request.endDate)}
                </span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  ({request.totalDays} {request.totalDays === 1 ? 'day' : 'days'})
                </span>
              </div>
            </div>
          </div>

          {/* Right Metrics & Actions */}
          <div className="flex items-center gap-4 flex-wrap lg:flex-nowrap justify-between lg:justify-end">
            <div className="flex items-center gap-3 text-xs">
              {/* Waiting time badge */}
              {isPending && (
                <div
                  className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-900/60"
                  title={request.createdAt ? `Applied on ${formatDate(request.createdAt)}` : 'Pending request'}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>Waiting {formatWaitingTime(request.createdAt)}</span>
                </div>
              )}

              {/* Remaining balance */}
              {balanceDisplay && (
                <div
                  className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium border border-neutral-200 dark:border-neutral-700"
                  title="Employee remaining balance for this leave type"
                >
                  Balance: <span className="font-bold text-primary-600 dark:text-primary-400">{balanceDisplay}</span>
                </div>
              )}
            </div>

            {/* Decision Actions */}
            {isPending && (
              <div className="flex items-center gap-2 shrink-0">
                {isOwnRequest && !isAdmin ? (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-medium border border-neutral-200 dark:border-neutral-700">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                    <span>Your request (Admin decides)</span>
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onReject(request)}
                      disabled={isApproving}
                      className="btn btn-secondary btn-sm text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      Reject...
                    </button>
                    <button
                      type="button"
                      onClick={() => onApprove(request)}
                      disabled={isApproving}
                      className="btn btn-primary btn-sm text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {isApproving ? 'Approving...' : 'Approve'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* If decided already */}
            {isApproved && (
              <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Approved {request.approvedByName ? `by ${request.approvedByName}` : ''}</span>
              </div>
            )}
            {isRejected && (
              <div className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                <XCircle className="h-4 w-4" />
                <span>Rejected</span>
              </div>
            )}
          </div>
        </div>

        {/* Reason callout */}
        {request.reason && (
          <p className="text-xs text-neutral-600 dark:text-neutral-400 italic bg-neutral-50 dark:bg-neutral-800/40 p-2.5 rounded-lg border border-neutral-100 dark:border-neutral-800">
            "{request.reason}"
          </p>
        )}

        {/* Who else is away context */}
        {isPending && (
          <WhoElseIsAwayBadge
            request={request}
            allTeamLeaves={allTeamLeaves}
            onViewCalendar={onViewCalendar}
          />
        )}
      </div>
    );
  }

  // Card view mode (default)
  return (
    <div className="card p-5 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md">
      {/* Top row: Avatar, Name, Waiting time badge */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={request.employeeName} size="md" className="shrink-0" />
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                {request.employeeName}
              </h4>
              <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                <span>{request.employeeCode}</span>
                {request.departmentName && (
                  <>
                    <span>·</span>
                    <span className="truncate">{request.departmentName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Waiting Badge */}
          {isPending && (
            <div
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200/80 dark:border-amber-900/60 shrink-0"
              title={request.createdAt ? `Applied on ${formatDate(request.createdAt)}` : 'Pending request'}
            >
              <Clock className="h-3 w-3 shrink-0" />
              <span>Waiting {formatWaitingTime(request.createdAt)}</span>
            </div>
          )}
        </div>

        {/* Leave Type and Dates */}
        <div className="mt-3.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-700/60 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span
              style={{ backgroundColor: theme.hex }}
              className="px-2 py-0.5 rounded text-[11px] font-semibold text-white shadow-2xs"
            >
              {request.leaveTypeName}
            </span>
            <span className="font-bold text-neutral-900 dark:text-white">
              {request.totalDays} {request.totalDays === 1 ? 'working day' : 'working days'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-300">
            <span className="flex items-center gap-1 text-neutral-400">
              <Calendar className="h-3.5 w-3.5" />
              <span>Period:</span>
            </span>
            <span className="font-semibold">
              {formatDate(request.startDate)} – {formatDate(request.endDate)}
            </span>
          </div>

          {/* Remaining Balance */}
          {balanceDisplay && (
            <div className="flex items-center justify-between text-xs text-neutral-600 dark:text-neutral-300 pt-1.5 border-t border-neutral-200/60 dark:border-neutral-700/60">
              <span className="text-neutral-400">Remaining Balance:</span>
              <span className="font-bold text-primary-600 dark:text-primary-400">
                {balanceDisplay}
              </span>
            </div>
          )}
        </div>

        {/* Reason */}
        {request.reason && (
          <p className="mt-3 text-xs text-neutral-600 dark:text-neutral-400 italic line-clamp-2">
            "{request.reason}"
          </p>
        )}
      </div>

      {/* Bottom section: Who else is away & Decision actions */}
      <div className="space-y-3 pt-1">
        {/* Who else is away context */}
        {isPending && (
          <WhoElseIsAwayBadge
            request={request}
            allTeamLeaves={allTeamLeaves}
            onViewCalendar={onViewCalendar}
          />
        )}

        {/* Decision Actions Bar */}
        {isPending ? (
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            {isOwnRequest && !isAdmin ? (
              <div className="w-full text-center py-2 px-3 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 text-xs font-medium border border-neutral-200 dark:border-neutral-700 flex items-center justify-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                <span>Your own request (Requires Admin approval)</span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onReject(request)}
                  disabled={isApproving}
                  className="btn btn-secondary btn-md flex-1 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  Reject...
                </button>
                <button
                  type="button"
                  onClick={() => onApprove(request)}
                  disabled={isApproving}
                  className="btn btn-primary btn-md flex-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isApproving ? 'Approving...' : 'Approve'}
                </button>
              </>
            )}
          </div>
        ) : isApproved ? (
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5 justify-center py-1">
            <CheckCircle2 className="h-4 w-4" />
            <span>Approved {request.approvedByName ? `by ${request.approvedByName}` : ''}</span>
          </div>
        ) : isRejected ? (
          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs text-rose-600 dark:text-rose-400 font-medium py-1 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>Rejected</span>
            </div>
            {request.rejectionReason && (
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 italic">
                Reason: "{request.rejectionReason}"
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
