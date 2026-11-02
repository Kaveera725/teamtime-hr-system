import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { LeaveRequestDto } from '@/types/api';
import { formatDate } from '@/lib/utils';

interface RejectLeaveModalProps {
  isOpen: boolean;
  request: LeaveRequestDto | null;
  isLoading: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export const RejectLeaveModal: React.FC<RejectLeaveModalProps> = ({
  isOpen,
  request,
  isLoading,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !request) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('A rejection reason is required so the employee understands the decision.');
      return;
    }
    setError('');
    onConfirm(trimmed);
  };

  const handleClose = () => {
    if (isLoading) return;
    setReason('');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-dialog-title"
    >
      <div className="w-full max-w-lg card p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h3 id="reject-dialog-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Reject Leave Request
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Provide feedback for <span className="font-medium text-neutral-700 dark:text-neutral-300">{request.employeeName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Request Summary Callout */}
        <div className="my-4 p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
            <span>Leave Type:</span>
            <span className="font-semibold text-neutral-900 dark:text-white">{request.leaveTypeName}</span>
          </div>
          <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-300">
            <span>Dates:</span>
            <span className="font-semibold text-neutral-900 dark:text-white">
              {formatDate(request.startDate)} – {formatDate(request.endDate)} ({request.totalDays} {request.totalDays === 1 ? 'day' : 'days'})
            </span>
          </div>
          {request.reason && (
            <div className="pt-1 border-t border-neutral-200 dark:border-neutral-700/50 text-neutral-500 dark:text-neutral-400 italic">
              Employee reason: "{request.reason}"
            </div>
          )}
        </div>

        {/* Reason Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="rejectionReason" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Rejection Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="rejectionReason"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g., Critical sprint release scheduled on these dates, insufficient team coverage, or please reschedule."
              disabled={isLoading}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 bg-white dark:bg-neutral-800 focus:outline-hidden focus:ring-2 transition-all ${
                error
                  ? 'border-rose-500 focus:ring-rose-500/20'
                  : 'border-neutral-300 dark:border-neutral-700 focus:border-primary-500 focus:ring-primary-500/20'
              }`}
            />
            {error && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="btn btn-secondary btn-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-md bg-rose-600 hover:bg-rose-700 text-white font-medium"
            >
              {isLoading ? 'Rejecting...' : 'Reject Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

