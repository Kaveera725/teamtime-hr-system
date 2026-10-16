import React, { useState } from 'react';
import {
  X,
  Download,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { api, getErrorMessage } from '@/lib/api';
import { AttendanceBadge, MissingCheckOutBadge } from '@/components/ui/StatusBadge';
import { formatTime } from '@/lib/utils';
import { toast } from 'sonner';
import type { AttendanceDto } from '@/types/api';

interface EmployeeAttendanceModalProps {
  employeeId: number | string;
  employeeName: string;
  employeeCode?: string;
  departmentName?: string;
  onClose: () => void;
}

export const EmployeeAttendanceModal: React.FC<EmployeeAttendanceModalProps> = ({
  employeeId,
  employeeName,
  employeeCode,
  departmentName,
  onClose,
}) => {
  const today = new Date();
  const [fromDate, setFromDate] = useState<string>(format(subDays(today, 30), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState<string>(format(today, 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Fetch target employee attendance history
  const { data: records = [], isLoading, error } = useQuery<AttendanceDto[]>({
    queryKey: ['employeeAttendance', employeeId, fromDate, toDate],
    queryFn: async () => {
      const res = await api.get<AttendanceDto[]>(`/attendance/employee/${employeeId}`, {
        params: { from: fromDate, to: toDate },
      });
      return res.data;
    },
    enabled: !!employeeId,
  });

  // Calculate summary stats
  const stats = React.useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let totalHours = 0;
    let countWithHours = 0;

    for (const r of records) {
      const s = (r.status || '').toUpperCase();
      if (s === 'PRESENT' || s === 'LATE' || s === 'HALF_DAY') present++;
      if (s === 'LATE') late++;
      if (s === 'ABSENT') absent++;
      if (r.workedHours && r.workedHours > 0) {
        totalHours += r.workedHours;
        countWithHours++;
      }
    }

    const avg = countWithHours > 0 ? (totalHours / countWithHours).toFixed(1) : '0.0';
    return { present, late, absent, totalHours: totalHours.toFixed(1), avg };
  }, [records]);

  // Filtered rows
  const filteredRecords = React.useMemo(() => {
    if (statusFilter === 'ALL') return records;
    return records.filter((r) => (r.status || '').toUpperCase() === statusFilter);
  }, [records, statusFilter]);

  // Export this employee's records to CSV
  const exportEmployeeCSV = () => {
    if (filteredRecords.length === 0) {
      toast.error('No records available to export.');
      return;
    }

    const headers = ['Date', 'Status', 'Check In', 'Check Out', 'Worked Hours', 'Missing Check-out', 'Notes'];
    const rows = filteredRecords.map((r) => [
      `"${r.attendanceDate || r.date || ''}"`,
      `"${r.status || ''}"`,
      `"${r.checkIn ? formatTime(r.checkIn) : ''}"`,
      `"${r.checkOut ? formatTime(r.checkOut) : ''}"`,
      `"${r.workedHours != null ? r.workedHours.toFixed(2) : ''}"`,
      `"${r.hasMissingCheckOut ? 'YES' : 'NO'}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance_${employeeCode || employeeId}_${fromDate}_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Employee attendance records exported.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-lg">
              {employeeName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                  {employeeName}
                </h3>
                {employeeCode && (
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                    {employeeCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {departmentName || 'Team Member'} · Attendance History & Audit
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Summary Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/60">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase">Days Present</span>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {stats.present}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/60">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase">Late Count</span>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {stats.late}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/60">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase">Avg Hours / Day</span>
              <div className="text-xl font-bold text-primary-600 dark:text-primary-400 mt-0.5">
                {stats.avg}h
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/80 dark:border-neutral-700/60">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase">Absences</span>
              <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                {stats.absent}
              </div>
            </div>
          </div>

          {/* Date range filter & CSV download */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-neutral-500">Range:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input text-xs py-1 px-2 w-auto"
              />
              <span className="text-neutral-400">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input text-xs py-1 px-2 w-auto"
              />
            </div>

            <button
              onClick={exportEmployeeCSV}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs shadow-sm"
            >
              <Download className="h-3.5 w-3.5 text-primary-500" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 overflow-x-auto text-xs">
            {['ALL', 'PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-full font-medium transition-colors ${
                  statusFilter === st
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}
              >
                {st === 'ALL' ? 'All' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="py-12 text-center text-xs text-neutral-400">Loading history records...</div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs">
              {getErrorMessage(error)}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-left text-xs data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hours</th>
                    <th>Flags</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((r, i) => (
                      <tr key={r.id || i}>
                        <td className="font-semibold whitespace-nowrap">
                          {r.attendanceDate || r.date}
                        </td>
                        <td>
                          <AttendanceBadge status={r.status} />
                        </td>
                        <td className="font-mono">
                          {r.checkIn ? formatTime(r.checkIn) : '--'}
                        </td>
                        <td className="font-mono">
                          {r.checkOut ? formatTime(r.checkOut) : '--'}
                        </td>
                        <td className="font-mono font-bold">
                          {r.workedHours != null && r.workedHours > 0
                            ? `${r.workedHours.toFixed(1)}h`
                            : '--'}
                        </td>
                        <td>
                          {r.hasMissingCheckOut ? (
                            <MissingCheckOutBadge />
                          ) : (
                            <span className="text-neutral-400">--</span>
                          )}
                        </td>
                        <td className="max-w-xs truncate text-neutral-600 dark:text-neutral-400">
                          {r.notes || '--'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-400">
                        No records match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
