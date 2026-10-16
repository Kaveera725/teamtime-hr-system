import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { LeaveDateRangePicker } from './LeaveDateRangePicker';
import { cn } from '@/lib/utils';
import type {
  LeaveTypeDto,
  LeaveBalanceDto,
  LeaveRequestPreviewResponseDto,
  CreateLeaveRequestDto,
  LeaveRequestDto,
} from '@/types/api';

interface ApplyLeaveSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedYear: number;
}

export const ApplyLeaveSheet: React.FC<ApplyLeaveSheetProps> = ({
  isOpen,
  onClose,
  selectedYear,
}) => {
  const queryClient = useQueryClient();

  // Form states
  const [leaveTypeId, setLeaveTypeId] = useState<number | ''>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');

  // Preview state
  const [previewData, setPreviewData] = useState<LeaveRequestPreviewResponseDto | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // 1. Fetch available leave types and user balances
  const { data: leaveTypes = [], isLoading: isTypesLoading } = useQuery<LeaveTypeDto[]>({
    queryKey: ['leaveTypes'],
    queryFn: async () => {
      const res = await api.get<LeaveTypeDto[]>('/leave-types');
      return res.data.filter((t) => t.isActive);
    },
    enabled: isOpen,
  });

  const { data: userBalances = [] } = useQuery<LeaveBalanceDto[]>({
    queryKey: ['myLeaveBalances', selectedYear],
    queryFn: async () => {
      const res = await api.get<LeaveBalanceDto[]>('/leave-balances/my', {
        params: { year: selectedYear },
      });
      return res.data;
    },
    enabled: isOpen,
  });

  // Selected leave type metadata
  const selectedLeaveType = leaveTypes.find((t) => Number(t.id) === Number(leaveTypeId));
  const isMedicalLeave =
    selectedLeaveType?.name.toLowerCase().includes('medical') ?? false;

  // Single day check: half-day only valid when startDate === endDate
  const isSingleDay = Boolean(startDate && endDate && startDate === endDate);

  // Reset half-day if range extends to more than 1 day
  useEffect(() => {
    if (!isSingleDay && isHalfDay) {
      setIsHalfDay(false);
    }
  }, [isSingleDay, isHalfDay]);

  // Set default leave type if none selected
  useEffect(() => {
    if (isOpen && !leaveTypeId && leaveTypes.length > 0) {
      setLeaveTypeId(Number(leaveTypes[0].id));
    }
  }, [isOpen, leaveTypes, leaveTypeId]);

  // Reset form when sheet opens
  const handleSheetClose = () => {
    setPreviewData(null);
    setPreviewError(null);
    onClose();
  };

  // Debounced Live Preview calculation
  const previewAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (!leaveTypeId || !startDate || !endDate) {
      setPreviewData(null);
      setPreviewError(null);
      setIsPreviewLoading(false);
      return;
    }

    if (previewAbortRef.current) {
      previewAbortRef.current.abort();
    }
    const abortController = new AbortController();
    previewAbortRef.current = abortController;

    const timer = setTimeout(async () => {
      setIsPreviewLoading(true);
      setPreviewError(null);

      try {
        const payload = {
          leaveTypeId: Number(leaveTypeId),
          startDate,
          endDate,
          isHalfDay: isSingleDay ? isHalfDay : false,
        };

        const res = await api.post<LeaveRequestPreviewResponseDto>(
          '/leave-requests/preview',
          payload,
          { signal: abortController.signal }
        );

        setPreviewData(res.data);
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          setPreviewError(getErrorMessage(err));
          setPreviewData(null);
        }
      } finally {
        setIsPreviewLoading(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [leaveTypeId, startDate, endDate, isHalfDay, isSingleDay, isOpen]);

  // Mutation for submitting leave request with optimistic updates & rollback
  const applyMutation = useMutation({
    mutationFn: async (dto: CreateLeaveRequestDto) => {
      const res = await api.post<LeaveRequestDto>('/leave-requests', dto);
      return res.data;
    },
    onMutate: async (newRequestDto) => {
      // 1. Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['myLeaveRequests'] });
      await queryClient.cancelQueries({ queryKey: ['myLeaveBalances'] });

      // 2. Snapshot current caches for rollback
      const prevRequests = queryClient.getQueryData(['myLeaveRequests', selectedYear]);
      const prevBalances = queryClient.getQueryData<LeaveBalanceDto[]>([
        'myLeaveBalances',
        selectedYear,
      ]);

      // 3. Compute working days optimistically
      const workingDays = previewData?.workingDays ?? (newRequestDto.isHalfDay ? 0.5 : 1);

      // 4. Optimistically update balances
      if (prevBalances) {
        queryClient.setQueryData<LeaveBalanceDto[]>(
          ['myLeaveBalances', selectedYear],
          (old = []) =>
            old.map((b) => {
              if (Number(b.leaveTypeId) === Number(newRequestDto.leaveTypeId)) {
                const currentPending = b.pendingDays ?? b.pending ?? 0;
                const newPending = currentPending + workingDays;
                const remaining = b.remainingDays ?? b.remaining ?? 0;
                return {
                  ...b,
                  pendingDays: newPending,
                  pending: newPending,
                  availableDays: Math.max(0, remaining - newPending),
                };
              }
              return b;
            })
        );
      }

      // Return rollback context
      return { prevRequests, prevBalances };
    },
    onError: (err, _variables, context) => {
      // Rollback on error
      if (context?.prevRequests) {
        queryClient.setQueryData(['myLeaveRequests', selectedYear], context.prevRequests);
      }
      if (context?.prevBalances) {
        queryClient.setQueryData(['myLeaveBalances', selectedYear], context.prevBalances);
      }
      toast.error(getErrorMessage(err));
    },
    onSuccess: () => {
      toast.success('Leave request submitted successfully!', {
        description: 'Your manager has been notified and your request is pending review.',
      });
      // Invalidate to refetch fresh server state
      queryClient.invalidateQueries({ queryKey: ['myLeaveRequests'] });
      queryClient.invalidateQueries({ queryKey: ['myLeaveBalances'] });
      queryClient.invalidateQueries({ queryKey: ['employeeDashboard'] });

      // Reset and close
      setStartDate('');
      setEndDate('');
      setReason('');
      setIsHalfDay(false);
      setPreviewData(null);
      handleSheetClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!leaveTypeId) {
      toast.error('Please select a leave type.');
      return;
    }

    if (!startDate || !endDate) {
      toast.error('Please select valid start and end dates.');
      return;
    }

    if (previewData && !previewData.isValid) {
      toast.error('Please resolve the highlighted rule violations before submitting.');
      return;
    }

    applyMutation.mutate({
      leaveTypeId: Number(leaveTypeId),
      startDate,
      endDate,
      isHalfDay: isSingleDay ? isHalfDay : false,
      reason: reason.trim() || null,
    });
  };

  if (!isOpen) return null;

  // Validation readiness
  const hasViolations =
    (previewData && (!previewData.isValid || previewData.validationErrors.length > 0)) ||
    Boolean(previewError);

  const canSubmit =
    Boolean(leaveTypeId && startDate && endDate) &&
    !hasViolations &&
    !isPreviewLoading &&
    !applyMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={handleSheetClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
                  <Calendar className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  Apply for Leave
                </h2>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Select your dates and check live allowance validation before submission.
              </p>
            </div>
            <button
              onClick={handleSheetClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form Body (Scrollable) */}
          <form
            id="apply-leave-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-6 space-y-6"
          >
            {/* 1. Leave Type Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Leave Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(Number(e.target.value))}
                className="input py-2 text-sm font-medium"
                disabled={isTypesLoading}
              >
                {leaveTypes.map((type) => {
                  const b = userBalances.find(
                    (ub) => Number(ub.leaveTypeId) === Number(type.id)
                  );
                  const rem = b?.remainingDays ?? b?.remaining ?? type.defaultDays;
                  const isNoPay = type.name.toLowerCase().includes('no pay');
                  return (
                    <option key={type.id} value={type.id}>
                      {type.name} {isNoPay ? '(Uncapped)' : `(${rem} days remaining)`}
                    </option>
                  );
                })}
              </select>

              {selectedLeaveType && (
                <div className="flex items-center justify-between text-[11px] text-neutral-500 mt-1 px-1">
                  <span>
                    {selectedLeaveType.description ||
                      `${selectedLeaveType.name} allowance allocation.`}
                  </span>
                  {isMedicalLeave && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Backdating allowed (up to 3 days)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 2. Interactive Date Range Picker */}
            <div className="space-y-1.5">
              <LeaveDateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
                isMedicalLeave={isMedicalLeave}
              />
            </div>

            {/* 3. Half-Day Toggle (Visible only when one date is chosen) */}
            <div
              className={cn(
                'p-3.5 rounded-xl border transition-all duration-200',
                isSingleDay
                  ? 'bg-neutral-50/70 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-800'
                  : 'bg-neutral-50/30 dark:bg-neutral-900/20 border-neutral-100 dark:border-neutral-850 opacity-60'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                    <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      Half-Day Leave
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {isSingleDay
                      ? 'Deducts 0.5 working days instead of a full day'
                      : 'Only available when applying for a single day'}
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isHalfDay}
                    disabled={!isSingleDay}
                    onChange={(e) => setIsHalfDay(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>

            {/* 4. Reason Textarea with Character Counter */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Reason for Leave <span className="text-neutral-400 font-normal">(Optional)</span>
                </label>
                <span
                  className={cn(
                    'text-[11px] font-medium',
                    reason.length > 450
                      ? 'text-rose-500 font-semibold'
                      : 'text-neutral-400 dark:text-neutral-500'
                  )}
                >
                  {reason.length} / 500 characters
                </span>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="State your reason or any handover details for your team..."
                className="input py-2 text-xs leading-relaxed resize-none"
              />
            </div>

            {/* 5. Live Calculation Preview & Rule Violations Display */}
            {isPreviewLoading && (
              <div className="p-4 rounded-xl border border-primary-200 dark:border-primary-900/60 bg-primary-50/50 dark:bg-primary-950/30 flex items-center gap-3 animate-pulse">
                <Loader2 className="h-5 w-5 text-primary-600 animate-spin shrink-0" />
                <div className="text-xs text-primary-800 dark:text-primary-300">
                  Calculating working days and checking balance policies...
                </div>
              </div>
            )}

            {/* Rule Violations Alert */}
            {previewData && !previewData.isValid && previewData.validationErrors.length > 0 && (
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/80 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 font-semibold text-xs text-rose-700 dark:text-rose-300">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>Policy Rule Violations</span>
                </div>
                <ul className="text-xs space-y-1 list-disc pl-5">
                  {previewData.validationErrors.map((err, i) => (
                    <li key={i} className="leading-snug">
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Network or Other Preview Error */}
            {previewError && !previewData && (
              <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/80 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{previewError}</span>
              </div>
            )}

            {/* Valid Live Calculation Summary */}
            {previewData && previewData.isValid && (
              <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <span>
                      {previewData.workingDays} working day
                      {previewData.workingDays === 1 ? '' : 's'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300/60 dark:border-emerald-700">
                    Approved to submit
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200 bg-white/70 dark:bg-neutral-900/70 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900">
                  <div className="text-center">
                    <span className="block text-[10px] text-neutral-400 uppercase font-medium">
                      Current Available
                    </span>
                    <strong className="text-xs font-bold text-neutral-800 dark:text-neutral-100">
                      {previewData.availableBalance}d
                    </strong>
                  </div>

                  <ArrowRight className="h-4 w-4 text-neutral-400" />

                  <div className="text-center">
                    <span className="block text-[10px] text-neutral-400 uppercase font-medium">
                      Requested
                    </span>
                    <strong className="text-xs font-bold text-primary-600 dark:text-primary-400">
                      {previewData.workingDays}d
                    </strong>
                  </div>

                  <ArrowRight className="h-4 w-4 text-neutral-400" />

                  <div className="text-center">
                    <span className="block text-[10px] text-neutral-400 uppercase font-medium">
                      Balance After
                    </span>
                    <strong className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {previewData.balanceAfter}d
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Footer Actions */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleSheetClose}
              disabled={applyMutation.isPending}
              className="btn btn-secondary btn-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="apply-leave-form"
              disabled={!canSubmit}
              className={cn(
                'btn btn-primary btn-md font-semibold min-w-36 flex items-center justify-center gap-2 shadow-sm',
                !canSubmit && 'opacity-50 cursor-not-allowed'
              )}
            >
              {applyMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Submit Request</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
