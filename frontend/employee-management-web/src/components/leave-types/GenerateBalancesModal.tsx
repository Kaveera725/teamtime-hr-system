import React, { useState } from 'react';
import {
  Sparkles,
  X,
  CheckCircle2,
  Users,
  Settings,
  PlusCircle,
  SkipForward,
  Loader2,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import type { GenerateLeaveBalancesResultDto } from '@/types/api';

interface GenerateBalancesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GenerateBalancesModal: React.FC<GenerateBalancesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;

  const [selectedYear, setSelectedYear] = useState<number>(nextYear);
  const [result, setResult] = useState<GenerateLeaveBalancesResultDto | null>(null);

  const dialogRef = useDialogAccessibility<HTMLDivElement>({
    isOpen,
    onClose: () => {
      if (!generateMutation.isPending) {
        setResult(null);
        onClose();
      }
    },
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async (year: number) => {
      const res = await api.post<GenerateLeaveBalancesResultDto>(
        `/leave-balances/generate?year=${year}`
      );
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Leave balances generated for ${data.year}!`, {
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ['myLeaveBalances'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
      queryClient.invalidateQueries({ queryKey: ['leaveTypes'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const handleClose = () => {
    if (generateMutation.isPending) return;
    setResult(null);
    onClose();
  };

  const handleConfirm = () => {
    generateMutation.mutate(selectedYear);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !generateMutation.isPending) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gen-balances-title"
        className="w-full max-w-lg card p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {result ? 'Generation Results' : "Generate Next Year's Balances"}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {result
                  ? 'Yearly balance allocation complete.'
                  : 'Batch-credit annual leave entitlements for company personnel.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={generateMutation.isPending}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content: Confirmation or Result Summary */}
        {!result ? (
          <div className="my-5 space-y-4">
            <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 text-xs text-indigo-900 dark:text-indigo-300 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-sm text-indigo-950 dark:text-indigo-200">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Idempotent Annual Rollforward</span>
              </div>
              <p className="text-[12px] leading-relaxed">
                This administrative operation inspects all <strong>active employees</strong> and credits their default allowance across all <strong>active leave types</strong> for the selected year.
              </p>
              <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400 italic">
                ✓ Existing employee balances will <strong>never be duplicated</strong> or overwritten.
              </p>
            </div>

            {/* Target Year Selector */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Target Allocation Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                disabled={generateMutation.isPending}
                className="input input-md text-xs sm:text-sm font-semibold w-full"
              >
                <option value={currentYear}>{currentYear} (Current Calendar Year)</option>
                <option value={nextYear}>{nextYear} (Upcoming Calendar Year)</option>
                <option value={nextYear + 1}>{nextYear + 1} (Future Year)</option>
              </select>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={handleClose}
                disabled={generateMutation.isPending}
                className="btn btn-secondary btn-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={generateMutation.isPending}
                className="btn btn-primary btn-md font-semibold min-w-40 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Generate for {selectedYear}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Result Summary View */
          <div className="my-5 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Balances Successfully Synchronized</span>
              </div>
              <p className="text-emerald-800 dark:text-emerald-300 text-xs">
                {result.message}
              </p>
            </div>

            {/* Metric Stat Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <PlusCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Created</span>
                </div>
                <div className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                  {result.balancesCreatedCount}
                </div>
                <div className="text-[10px] text-neutral-400">New balance records</div>
              </div>

              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <SkipForward className="h-3.5 w-3.5 text-neutral-400" />
                  <span>Skipped</span>
                </div>
                <div className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                  {result.balancesSkippedCount}
                </div>
                <div className="text-[10px] text-neutral-400">Already allocated</div>
              </div>

              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <Users className="h-3.5 w-3.5 text-primary-500" />
                  <span>Employees</span>
                </div>
                <div className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                  {result.activeEmployeesCount}
                </div>
                <div className="text-[10px] text-neutral-400">Active roster count</div>
              </div>

              <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <Settings className="h-3.5 w-3.5 text-primary-500" />
                  <span>Leave Types</span>
                </div>
                <div className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                  {result.activeLeaveTypesCount}
                </div>
                <div className="text-[10px] text-neutral-400">Active policy types</div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-primary btn-md"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

