import React, { useState } from 'react';
import {
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
} from 'lucide-react';
import { LeaveBadge } from '@/components/ui/StatusBadge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, cn } from '@/lib/utils';
import { isCancellationAllowed } from './LeaveRequestDetailDrawer';
import type { LeaveRequestDto, LeaveStatus } from '@/types/api';

interface LeaveRequestsTableProps {
  requests: LeaveRequestDto[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  statusFilter: LeaveStatus | 'ALL';
  onStatusFilterChange: (status: LeaveStatus | 'ALL') => void;
  yearFilter: number;
  onYearFilterChange: (year: number) => void;
  onSelectRequest: (request: LeaveRequestDto) => void;
  onCancelRequest: (request: LeaveRequestDto) => void;
}

export const LeaveRequestsTable: React.FC<LeaveRequestsTableProps> = ({
  requests,
  totalCount,
  currentPage,
  totalPages,
  isLoading,
  onPageChange,
  statusFilter,
  onStatusFilterChange,
  yearFilter,
  onYearFilterChange,
  onSelectRequest,
  onCancelRequest,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Available years for dropdown (e.g. 2026, 2025, 2024)
  const currentYear = new Date().getFullYear();
  const availableYears = [currentYear, currentYear - 1, currentYear - 2];

  // Local search filter for leave type or reason
  const filteredRequests = requests.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const typeMatch = r.leaveTypeName?.toLowerCase().includes(term);
    const reasonMatch = r.reason?.toLowerCase().includes(term);
    return typeMatch || reasonMatch;
  });

  return (
    <div className="card overflow-hidden space-y-0">
      {/* Table Toolbar & Filters */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <span>My Leave History</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-normal">
              {totalCount} total
            </span>
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Click any row to view complete timeline details and review audit remarks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search type or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input text-xs py-1.5 pl-8 pr-3 w-44 md:w-52"
            />
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          </div>

          {/* Year selector */}
          <select
            value={yearFilter}
            onChange={(e) => onYearFilterChange(Number(e.target.value))}
            className="input text-xs py-1.5 px-2.5 w-28 font-medium cursor-pointer"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <div className="flex items-center p-0.5 rounded-lg bg-neutral-200/70 dark:bg-neutral-800 text-xs">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => onStatusFilterChange(st)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all capitalize',
                  statusFilter === st
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                )}
              >
                {st === 'ALL' ? 'All' : st.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Body */}
      {isLoading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : filteredRequests.length === 0 ? (
        <div className="p-8">
          <EmptyState
            icon={Calendar}
            title="No leave requests found"
            description={
              statusFilter !== 'ALL'
                ? `You have no ${statusFilter.toLowerCase()} leave requests for year ${yearFilter}.`
                : `You haven't submitted any leave requests for year ${yearFilter} yet.`
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full data-table text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
                <th className="py-3 px-4">Leave Type</th>
                <th className="py-3 px-4">Date Range</th>
                <th className="py-3 px-4">Days</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Applied Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800/80 text-xs">
              {filteredRequests.map((request) => {
                const canCancel = isCancellationAllowed(request);

                return (
                  <tr
                    key={request.id}
                    onClick={() => onSelectRequest(request)}
                    className="cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
                  >
                    {/* Leave Type */}
                    <td className="py-3 px-4 font-semibold text-neutral-900 dark:text-neutral-100">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary-500 shrink-0" />
                        <span>{request.leaveTypeName}</span>
                      </div>
                    </td>

                    {/* Date Range */}
                    <td className="py-3 px-4 text-neutral-700 dark:text-neutral-300 font-medium whitespace-nowrap">
                      {formatDate(request.startDate)} &rarr; {formatDate(request.endDate)}
                    </td>

                    {/* Total Days */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700">
                        {request.totalDays} day{request.totalDays === 1 ? '' : 's'}
                        {request.totalDays === 0.5 && ' (Half)'}
                      </span>
                    </td>

                    {/* Reason snippet */}
                    <td className="py-3 px-4 text-neutral-500 max-w-xs truncate">
                      {request.reason || <span className="text-neutral-400 italic">None</span>}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <LeaveBadge status={request.status} />
                    </td>

                    {/* Applied Date */}
                    <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                      {request.createdAt ? formatDate(request.createdAt) : '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onSelectRequest(request)}
                          title="View Details"
                          className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => onCancelRequest(request)}
                            title="Cancel Leave Request"
                            className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between text-xs text-neutral-500">
          <span>
            Page {currentPage} of {totalPages} ({totalCount} total items)
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
