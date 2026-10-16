import React from 'react';
import {
  X,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Trash2,
} from 'lucide-react';
import { parseISO } from 'date-fns';
import { LeaveBadge } from '@/components/ui/StatusBadge';
import { formatDate, formatDateTime } from '@/lib/utils';
import type { LeaveRequestDto } from '@/types/api';

interface LeaveRequestDetailDrawerProps {
  request: LeaveRequestDto | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelClick?: (request: LeaveRequestDto) => void;
}

/** Check if cancellation is allowed (BR-06): PENDING or APPROVED strictly before start date */
export function isCancellationAllowed(request: LeaveRequestDto): boolean {
  if (request.status === 'PENDING') return true;
  if (request.status === 'APPROVED') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    try {
      const start = parseISO(request.startDate);
      start.setHours(0, 0, 0, 0);
      return today < start;
    } catch {
      return false;
    }
  }
  return false;
}

export const LeaveRequestDetailDrawer: React.FC<LeaveRequestDetailDrawerProps> = ({
  request,
  isOpen,
  onClose,
  onCancelClick,
}) => {
  if (!isOpen || !request) return null;

  const canCancel = isCancellationAllowed(request);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                <Calendar className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {request.leaveTypeName}
                </h2>
                <span className="text-xs text-neutral-500 font-mono">
                  Ref #{request.id}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LeaveBadge status={request.status} />
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* PROMINENT REJECTION REASON BANNER (If rejected) */}
            {request.status === 'REJECTED' && (
              <div className="p-4 rounded-xl border-2 border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 shadow-sm space-y-2 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-xs uppercase tracking-wide">
                  <XCircle className="h-4 w-4 text-rose-600" />
                  <span>Reason for Rejection</span>
                </div>

                <div className="relative pl-3 border-l-2 border-rose-400 dark:border-rose-700 my-2">
                  <p className="text-sm font-medium text-rose-900 dark:text-rose-100 italic leading-relaxed">
                    &ldquo;{request.rejectionReason || 'No detailed reason specified by reviewer.'}&rdquo;
                  </p>
                </div>

                <div className="text-[11px] text-rose-700 dark:text-rose-300/80 pt-1 flex items-center justify-between">
                  <span>Reviewed by {request.approvedByName || 'Manager'}</span>
                  {request.approvedAt && (
                    <span>{formatDateTime(request.approvedAt)}</span>
                  )}
                </div>
              </div>
            )}

            {/* STATUS TIMELINE */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Approval Lifecycle
              </h3>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-800">
                {/* 1. Submitted Step */}
                <div className="relative flex items-start gap-3">
                  <div className="absolute -left-6 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-4 ring-white dark:ring-neutral-900">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      Request Submitted
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      {request.createdAt ? formatDateTime(request.createdAt) : 'Submitted'}
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Applied by {request.employeeName || 'Employee'}
                    </p>
                  </div>
                </div>

                {/* 2. Review Decision Step */}
                <div className="relative flex items-start gap-3">
                  {request.status === 'PENDING' && (
                    <>
                      <div className="absolute -left-6 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm ring-4 ring-white dark:ring-neutral-900 animate-pulse">
                        <Clock className="h-3 w-3" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          Pending Manager Review
                        </h4>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                          Currently awaiting departmental authorization.
                        </p>
                      </div>
                    </>
                  )}

                  {request.status === 'APPROVED' && (
                    <>
                      <div className="absolute -left-6 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-4 ring-white dark:ring-neutral-900">
                        <CheckCircle2 className="h-3 w-3" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          Approved
                        </h4>
                        <p className="text-[11px] text-neutral-500">
                          {request.approvedAt ? formatDateTime(request.approvedAt) : 'Approved'}
                        </p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Approved by {request.approvedByName || 'Authorized Reviewer'}
                        </p>
                      </div>
                    </>
                  )}

                  {request.status === 'REJECTED' && (
                    <>
                      <div className="absolute -left-6 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow-sm ring-4 ring-white dark:ring-neutral-900">
                        <XCircle className="h-3 w-3" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                          Rejected
                        </h4>
                        <p className="text-[11px] text-neutral-500">
                          {request.approvedAt ? formatDateTime(request.approvedAt) : 'Rejected'}
                        </p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Decision made by {request.approvedByName || 'Manager'}
                        </p>
                      </div>
                    </>
                  )}

                  {request.status === 'CANCELLED' && (
                    <>
                      <div className="absolute -left-6 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-400 text-white shadow-sm ring-4 ring-white dark:ring-neutral-900">
                        <Ban className="h-3 w-3" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                          Cancelled
                        </h4>
                        <p className="text-[11px] text-neutral-500">
                          {request.updatedAt ? formatDateTime(request.updatedAt) : 'Cancelled'}
                        </p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Request cancelled by employee (balance restored)
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* DETAILS GRID */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Leave Details
              </h3>

              <div className="card p-4 space-y-3 bg-neutral-50/50 dark:bg-neutral-850/40 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60 dark:border-neutral-800">
                  <span className="text-neutral-500">Schedule</span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatDate(request.startDate)} &rarr; {formatDate(request.endDate)}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60 dark:border-neutral-800">
                  <span className="text-neutral-500">Working Days</span>
                  <span className="font-bold text-primary-600 dark:text-primary-400">
                    {request.totalDays} day{request.totalDays === 1 ? '' : 's'}
                    {request.totalDays === 0.5 && ' (Half-Day)'}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60 dark:border-neutral-800">
                  <span className="text-neutral-500">Leave Type</span>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200">
                    {request.leaveTypeName}
                  </span>
                </div>

                {request.departmentName && (
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60 dark:border-neutral-800">
                    <span className="text-neutral-500">Department</span>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      {request.departmentName}
                    </span>
                  </div>
                )}

                <div>
                  <span className="block text-neutral-500 mb-1">Reason Submitted</span>
                  <div className="p-2.5 rounded bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs leading-relaxed">
                    {request.reason || (
                      <span className="text-neutral-400 italic">No notes provided with this request.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
            <button onClick={onClose} className="btn btn-secondary btn-sm">
              Close
            </button>

            {canCancel && onCancelClick && (
              <button
                onClick={() => onCancelClick(request)}
                className="btn btn-danger btn-sm flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Cancel Request</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
