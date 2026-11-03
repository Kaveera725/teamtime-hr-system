import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import { getLeaveTypeTheme } from './TeamLeaveCalendar';
import type { LeaveRequestDto } from '@/types/api';

interface WhoElseIsAwayBadgeProps {
  request: LeaveRequestDto;
  allTeamLeaves: LeaveRequestDto[];
  onViewCalendar?: () => void;
}

export const WhoElseIsAwayBadge: React.FC<WhoElseIsAwayBadgeProps> = ({
  request,
  allTeamLeaves,
  onViewCalendar,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter overlapping leaves from other team members
  const overlappingMembers = React.useMemo(() => {
    return allTeamLeaves.filter((lr) => {
      // Exclude self and non-active statuses
      if (lr.id === request.id || lr.employeeId === request.employeeId) return false;
      if (lr.status !== 'APPROVED' && lr.status !== 'PENDING') return false;

      // Check date interval overlap
      const overlap = lr.startDate <= request.endDate && request.startDate <= lr.endDate;
      return overlap;
    });
  }, [allTeamLeaves, request]);

  const count = overlappingMembers.length;

  if (count === 0) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-xs">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium">Full Coverage: No other team members are away on these dates.</span>
        </div>
        {onViewCalendar && (
          <button
            type="button"
            onClick={onViewCalendar}
            className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
          >
            Check Calendar
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-xs overflow-hidden">
      {/* Summary Banner */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/30 transition-colors"
      >
        <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold">
            {count} other {count === 1 ? 'colleague' : 'colleagues'} away during this period
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onViewCalendar && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewCalendar();
              }}
              className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              <Calendar className="h-3 w-3" />
              <span>Calendar</span>
            </button>
          )}
          <button
            type="button"
            className="p-0.5 rounded text-amber-700 dark:text-amber-300 hover:bg-amber-200/50 dark:hover:bg-amber-800/50"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded list of colleagues away */}
      {isExpanded && (
        <div className="px-3 pb-2.5 pt-1 border-t border-amber-200/60 dark:border-amber-800/40 space-y-2">
          {overlappingMembers.map((colleague) => {
            const theme = getLeaveTypeTheme(colleague.leaveTypeName);
            const isPending = colleague.status === 'PENDING';

            return (
              <div
                key={colleague.id}
                className="flex items-center justify-between gap-2 py-1 px-2 rounded-md bg-white/70 dark:bg-neutral-800/70 border border-amber-200/40 dark:border-amber-800/20"
              >
                <div className="flex items-center gap-2">
                  <Avatar name={colleague.employeeName} size="xs" />
                  <span className="font-medium text-neutral-900 dark:text-neutral-100 text-xs">
                    {colleague.employeeName}
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    ({formatDate(colleague.startDate)} – {formatDate(colleague.endDate)})
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    style={{ backgroundColor: theme.hex }}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold text-white shadow-2xs"
                  >
                    {colleague.leaveTypeName}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      isPending
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                    }`}
                  >
                    {colleague.status}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
