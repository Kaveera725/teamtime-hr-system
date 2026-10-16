import React from 'react';
import type { LeaveBalanceDto } from '@/types/api';
import { LeaveBalanceCard } from './LeaveBalanceCard';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { Calendar } from 'lucide-react';

interface LeaveBalanceGridProps {
  balances: LeaveBalanceDto[];
  isLoading: boolean;
  selectedYear: number;
}

export const LeaveBalanceGrid: React.FC<LeaveBalanceGridProps> = ({
  balances,
  isLoading,
  selectedYear,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-5 w-40 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardSkeleton className="h-56" />
          <CardSkeleton className="h-56" />
          <CardSkeleton className="h-56" />
          <CardSkeleton className="h-56" />
        </div>
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <div className="card p-8 text-center bg-neutral-50/50 dark:bg-neutral-900/50 border-dashed border-2">
        <Calendar className="h-10 w-10 text-neutral-400 mx-auto mb-3" />
        <h4 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
          No leave balances configured for {selectedYear}
        </h4>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
          Contact your HR administrator to initialize leave entitlements for this calendar year.
        </p>
      </div>
    );
  }

  // Calculate totals across balances
  const totalAllocated = balances.reduce(
    (sum, b) => sum + (b.allocatedDays ?? b.allocated ?? 0),
    0
  );
  const totalUsed = balances.reduce((sum, b) => sum + (b.usedDays ?? b.used ?? 0), 0);
  const totalRemaining = balances.reduce(
    (sum, b) => sum + (b.remainingDays ?? b.remaining ?? 0),
    0
  );
  const totalPending = balances.reduce(
    (sum, b) => sum + (b.pendingDays ?? b.pending ?? 0),
    0
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
            <span>Leave Balances</span>
            <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">
              ({selectedYear})
            </span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Current allocations, consumption history, and review locks.
          </p>
        </div>

        {/* Aggregate Summary Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
            Total Allocated: <strong className="font-semibold">{totalAllocated}d</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
            Used: <strong className="font-semibold">{totalUsed}d</strong>
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-200/50 dark:border-emerald-800/40">
            Available Remaining: <strong className="font-semibold">{totalRemaining}d</strong>
          </span>
          {totalPending > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium border border-amber-200/50 dark:border-amber-800/40">
              Pending: <strong className="font-semibold">{totalPending}d</strong>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {balances.map((balance) => (
          <LeaveBalanceCard key={balance.id || balance.leaveTypeId} balance={balance} />
        ))}
      </div>
    </div>
  );
};
