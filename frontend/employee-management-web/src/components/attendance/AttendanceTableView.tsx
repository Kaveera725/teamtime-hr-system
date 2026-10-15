import React, { useState, useMemo } from 'react';
import {
  Download,
  Search,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
} from 'date-fns';
import { AttendanceBadge, MissingCheckOutBadge } from '@/components/ui/StatusBadge';
import { formatTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { AttendanceDto } from '@/types/api';

interface AttendanceTableViewProps {
  records: AttendanceDto[];
  fromDate: string;
  toDate: string;
  onDateRangeChange: (from: string, to: string) => void;
  isLoading?: boolean;
}

export const AttendanceTableView: React.FC<AttendanceTableViewProps> = ({
  records,
  fromDate,
  toDate,
  onDateRangeChange,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(false); // default descending (newest first)

  // Filter records
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        // Status filter
        if (statusFilter !== 'ALL') {
          const s = (r.status || '').toUpperCase();
          if (s !== statusFilter) return false;
        }

        // Search in notes or date or employee name
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchDate = (r.attendanceDate || r.date || '').toLowerCase().includes(q);
          const matchNotes = (r.notes || '').toLowerCase().includes(q);
          const matchStatus = (r.status || '').toLowerCase().includes(q);
          if (!matchDate && !matchNotes && !matchStatus) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.attendanceDate || a.date || '';
        const dateB = b.attendanceDate || b.date || '';
        return sortAsc ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
      });
  }, [records, statusFilter, searchQuery, sortAsc]);

  // Client-side CSV export
  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      toast.error('No attendance records available to export.');
      return;
    }

    const headers = [
      'Date',
      'Day',
      'Status',
      'Check In',
      'Check Out',
      'Worked Hours',
      'Missing Check-out',
      'Notes',
    ];

    const rows = filteredRecords.map((r) => {
      const dStr = r.attendanceDate || r.date || '';
      let dayOfWeek = '';
      try {
        dayOfWeek = dStr ? format(new Date(dStr), 'EEEE') : '';
      } catch {
        dayOfWeek = '';
      }

      const inTime = r.checkIn ? formatTime(r.checkIn) : '';
      const outTime = r.checkOut ? formatTime(r.checkOut) : '';
      const worked = r.workedHours != null ? r.workedHours.toFixed(2) : '';
      const missing = r.hasMissingCheckOut ? 'YES' : 'NO';
      const notesClean = (r.notes || '').replace(/"/g, '""');

      return [
        `"${dStr}"`,
        `"${dayOfWeek}"`,
        `"${r.status || ''}"`,
        `"${inTime}"`,
        `"${outTime}"`,
        `"${worked}"`,
        `"${missing}"`,
        `"${notesClean}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance_records_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('CSV export completed successfully!', {
      description: `Exported ${filteredRecords.length} visible attendance records.`,
    });
  };

  // Quick Preset Handlers
  const handlePreset = (type: 'this_month' | 'last_30' | 'this_week' | 'ytd') => {
    const today = new Date();
    if (type === 'this_month') {
      const start = format(startOfMonth(today), 'yyyy-MM-dd');
      const end = format(endOfMonth(today), 'yyyy-MM-dd');
      onDateRangeChange(start, end);
    } else if (type === 'last_30') {
      const start = format(subDays(today, 30), 'yyyy-MM-dd');
      const end = format(today, 'yyyy-MM-dd');
      onDateRangeChange(start, end);
    } else if (type === 'this_week') {
      const start = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const end = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      onDateRangeChange(start, end);
    } else if (type === 'ytd') {
      const start = format(startOfYear(today), 'yyyy-MM-dd');
      const end = format(today, 'yyyy-MM-dd');
      onDateRangeChange(start, end);
    }
  };

  return (
    <div className="card p-5 sm:p-6 space-y-5">
      {/* Filters Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        {/* Date Range Inputs & Presets */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onDateRangeChange(e.target.value, toDate)}
              className="input text-xs py-1.5 px-2.5 w-auto"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => onDateRangeChange(fromDate, e.target.value)}
              className="input text-xs py-1.5 px-2.5 w-auto"
            />
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-lg">
            <button
              onClick={() => handlePreset('this_month')}
              className="px-2 py-1 text-xs font-medium rounded hover:bg-white dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              This Month
            </button>
            <button
              onClick={() => handlePreset('last_30')}
              className="px-2 py-1 text-xs font-medium rounded hover:bg-white dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              Last 30 Days
            </button>
            <button
              onClick={() => handlePreset('this_week')}
              className="px-2 py-1 text-xs font-medium rounded hover:bg-white dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              This Week
            </button>
          </div>
        </div>

        {/* Export Button */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <button
            onClick={exportToCSV}
            className="btn btn-secondary btn-sm flex items-center gap-2 shadow-sm"
            title="Download visible records as CSV file"
          >
            <Download className="h-4 w-4 text-primary-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Secondary Controls: Search and Status Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap transition-colors ${
                statusFilter === status
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              {status === 'ALL' ? 'All Records' : status.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Search notes, date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input text-xs pl-8 py-1.5 w-full"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-left text-sm data-table">
          <thead>
            <tr>
              <th
                onClick={() => setSortAsc(!sortAsc)}
                className="cursor-pointer hover:text-neutral-900 dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>Date</span>
                  <ArrowUpDown className="h-3 w-3 text-neutral-400" />
                </div>
              </th>
              <th>Status</th>
              <th>Clock In</th>
              <th>Clock Out</th>
              <th>Duration</th>
              <th>Flags</th>
              <th>Notes / Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.length > 0 ? (
              filteredRecords.map((r, idx) => {
                const dateVal = r.attendanceDate || r.date;
                let formattedDisplay = dateVal;
                let dayName = '';
                try {
                  if (dateVal) {
                    const parsed = new Date(dateVal);
                    formattedDisplay = format(parsed, 'MMM d, yyyy');
                    dayName = format(parsed, 'EEEE');
                  }
                } catch {
                  // fallback
                }

                return (
                  <tr key={r.id || idx}>
                    <td className="font-medium whitespace-nowrap">
                      <div className="text-neutral-900 dark:text-neutral-100 font-semibold">
                        {formattedDisplay}
                      </div>
                      <div className="text-[11px] text-neutral-400">{dayName}</div>
                    </td>

                    <td>
                      <AttendanceBadge status={r.status} />
                    </td>

                    <td className="font-mono text-xs whitespace-nowrap">
                      {r.checkIn ? (
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {formatTime(r.checkIn)}
                        </span>
                      ) : (
                        <span className="text-neutral-400">--</span>
                      )}
                    </td>

                    <td className="font-mono text-xs whitespace-nowrap">
                      {r.checkOut ? (
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {formatTime(r.checkOut)}
                        </span>
                      ) : (
                        <span className="text-neutral-400">--</span>
                      )}
                    </td>

                    <td className="font-mono text-xs whitespace-nowrap">
                      {r.workedHours != null && r.workedHours > 0 ? (
                        <span className="font-bold text-neutral-900 dark:text-neutral-50">
                          {r.workedHours.toFixed(1)} hrs
                        </span>
                      ) : (
                        <span className="text-neutral-400">--</span>
                      )}
                    </td>

                    <td>
                      {r.hasMissingCheckOut ? (
                        <div className="group relative inline-block">
                          <MissingCheckOutBadge />
                          <div className="opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-neutral-900 text-white text-[11px] rounded-lg shadow-lg z-30">
                            <strong>Missing Check-out:</strong> Employee logged a check-in but no check-out was registered before midnight.
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">None</span>
                      )}
                    </td>

                    <td className="max-w-xs truncate text-xs text-neutral-600 dark:text-neutral-300">
                      {r.notes ? (
                        <span title={r.notes}>{r.notes}</span>
                      ) : (
                        <span className="text-neutral-400 italic">None</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-12 text-center text-neutral-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileSpreadsheet className="h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                    <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                      No attendance records found
                    </p>
                    <p className="text-xs text-neutral-400 max-w-sm">
                      Try expanding your date range filter or changing the status filter above.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 pt-1">
        <span>
          Showing <strong>{filteredRecords.length}</strong> of <strong>{records.length}</strong> total records
        </span>
        <span>Dates: {fromDate} to {toDate}</span>
      </div>
    </div>
  );
};
