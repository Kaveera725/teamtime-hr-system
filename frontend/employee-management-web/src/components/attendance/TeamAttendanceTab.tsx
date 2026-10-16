import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Eye,
  Building,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays, subDays, isToday } from 'date-fns';
import { api, getErrorMessage } from '@/lib/api';
import { AttendanceBadge, MissingCheckOutBadge } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { formatTime } from '@/lib/utils';
import { EmployeeAttendanceModal } from './EmployeeAttendanceModal';
import { toast } from 'sonner';
import type { AttendanceSummaryDto } from '@/types/api';

export const TeamAttendanceTab: React.FC = () => {
  const [selectedDateStr, setSelectedDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected employee for history modal
  const [inspectionEmployee, setInspectionEmployee] = useState<{
    id: number | string;
    name: string;
    code?: string;
    dept?: string;
  } | null>(null);

  // Fetch roster summary for selected date
  const { data: summary, isLoading, error } = useQuery<AttendanceSummaryDto>({
    queryKey: ['attendanceTeamSummary', selectedDateStr],
    queryFn: async () => {
      const res = await api.get<AttendanceSummaryDto>('/attendance/today', {
        params: { date: selectedDateStr },
      });
      return res.data;
    },
  });

  const selectedDateObj = useMemo(() => {
    try {
      return new Date(selectedDateStr);
    } catch {
      return new Date();
    }
  }, [selectedDateStr]);

  const handlePrevDay = () => {
    setSelectedDateStr(format(subDays(selectedDateObj, 1), 'yyyy-MM-dd'));
  };

  const handleNextDay = () => {
    setSelectedDateStr(format(addDays(selectedDateObj, 1), 'yyyy-MM-dd'));
  };

  const handleToday = () => {
    setSelectedDateStr(format(new Date(), 'yyyy-MM-dd'));
  };

  // Build unified roster array
  const unifiedRoster = useMemo(() => {
    if (!summary) return [];

    const isDateInPast = selectedDateStr < format(new Date(), 'yyyy-MM-dd');
    const list: Array<{
      id: number;
      code: string;
      name: string;
      department: string;
      status: string;
      checkIn?: string;
      checkOut?: string;
      workedHours?: number;
      notes?: string;
      hasMissingCheckOut?: boolean;
    }> = [];

    // 1. Present employees (includes LATE & HALF_DAY)
    if (summary.presentEmployees) {
      for (const p of summary.presentEmployees) {
        const hasMissing = !!p.checkIn && !p.checkOut && isDateInPast;
        list.push({
          id: p.employeeId,
          code: p.employeeCode,
          name: p.fullName,
          department: p.departmentName,
          status: p.status,
          checkIn: p.checkIn,
          checkOut: p.checkOut,
          workedHours: p.workedHours,
          hasMissingCheckOut: hasMissing,
        });
      }
    }

    // 2. On Leave employees
    if (summary.onLeaveEmployees) {
      for (const l of summary.onLeaveEmployees) {
        list.push({
          id: l.employeeId,
          code: l.employeeCode,
          name: l.fullName,
          department: l.departmentName,
          status: 'ON_LEAVE',
          notes: `${l.leaveType} (${l.startDate} to ${l.endDate})`,
        });
      }
    }

    // 3. Absent employees
    if (summary.absentEmployees) {
      for (const a of summary.absentEmployees) {
        list.push({
          id: a.employeeId,
          code: a.employeeCode,
          name: a.fullName,
          department: a.departmentName,
          status: 'ABSENT',
          notes: 'No check-in recorded on working day',
        });
      }
    }

    return list;
  }, [summary, selectedDateStr]);

  // Filter roster by search & status
  const filteredRoster = useMemo(() => {
    return unifiedRoster.filter((item) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (item.status.toUpperCase() !== statusFilter) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchCode = item.code.toLowerCase().includes(q);
        const matchDept = item.department.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchDept) return false;
      }

      return true;
    });
  }, [unifiedRoster, statusFilter, searchQuery]);

  // Export visible roster to CSV
  const exportRosterCSV = () => {
    if (filteredRoster.length === 0) {
      toast.error('No roster records to export.');
      return;
    }

    const headers = [
      'Employee Code',
      'Employee Name',
      'Department',
      'Status',
      'Check In',
      'Check Out',
      'Worked Hours',
      'Missing Check-out',
      'Remarks',
    ];

    const rows = filteredRoster.map((r) => [
      `"${r.code}"`,
      `"${r.name}"`,
      `"${r.department}"`,
      `"${r.status}"`,
      `"${r.checkIn ? formatTime(r.checkIn) : ''}"`,
      `"${r.checkOut ? formatTime(r.checkOut) : ''}"`,
      `"${r.workedHours != null ? r.workedHours.toFixed(1) : ''}"`,
      `"${r.hasMissingCheckOut ? 'YES' : 'NO'}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `team_roster_${selectedDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredRoster.length} team roster entries.`);
  };

  return (
    <div className="space-y-6">
      {/* Date Switcher & Actions Header */}
      <div className="card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl">
            <button
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors"
              title="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="date"
              value={selectedDateStr}
              onChange={(e) => setSelectedDateStr(e.target.value)}
              className="input text-xs py-1 px-2.5 w-auto font-medium"
            />
            <button
              onClick={handleNextDay}
              className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors"
              title="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={handleToday}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              isToday(selectedDateObj)
                ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-200 dark:border-primary-800'
                : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            Today's Roster
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportRosterCSV}
            className="btn btn-secondary btn-sm flex items-center gap-2 shadow-sm"
            title="Download team roster for this date"
          >
            <Download className="h-4 w-4 text-primary-500" />
            <span>Export Roster CSV</span>
          </button>
        </div>
      </div>

      {/* Roster Counters Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card p-3.5 border-t-2 border-t-neutral-400">
          <span className="text-[11px] font-semibold text-neutral-500 uppercase">Total Team</span>
          <div className="text-xl sm:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {summary?.totalEmployees ?? '--'}
          </div>
        </div>

        <div className="card p-3.5 border-t-2 border-t-emerald-500">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Present</span>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {summary?.presentCount ?? '--'}
          </div>
        </div>

        <div className="card p-3.5 border-t-2 border-t-amber-500">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase">Late</span>
          <div className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">
            {summary?.lateCount ?? '--'}
          </div>
        </div>

        <div className="card p-3.5 border-t-2 border-t-sky-500">
          <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 uppercase">Half Day</span>
          <div className="text-xl sm:text-2xl font-extrabold text-sky-600 dark:text-sky-400 mt-0.5">
            {summary?.halfDayCount ?? '--'}
          </div>
        </div>

        <div className="card p-3.5 border-t-2 border-t-violet-500">
          <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400 uppercase">On Leave</span>
          <div className="text-xl sm:text-2xl font-extrabold text-violet-600 dark:text-violet-400 mt-0.5">
            {summary?.onLeaveCount ?? '--'}
          </div>
        </div>

        <div className="card p-3.5 border-t-2 border-t-rose-500">
          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase">Absent</span>
          <div className="text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
            {summary?.absentCount ?? '--'}
          </div>
        </div>
      </div>

      {/* Roster Table Card */}
      <div className="card p-5 sm:p-6 space-y-5">
        {/* Controls: Search and Status Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['ALL', 'PRESENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'ABSENT'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                }`}
              >
                {status === 'ALL' ? 'All Members' : status.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search employee, ID, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input text-xs pl-8 py-1.5 w-full"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="py-16 text-center text-xs text-neutral-400">Loading team attendance roster...</div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs">
            {getErrorMessage(error)}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-left text-sm data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Worked</th>
                  <th>Flags / Remarks</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoster.length > 0 ? (
                  filteredRoster.map((emp) => (
                    <tr key={emp.id}>
                      <td className="whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <Avatar name={emp.name} size="sm" />
                          <div>
                            <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-xs sm:text-sm">
                              {emp.name}
                            </div>
                            <div className="text-[11px] font-mono text-neutral-400">
                              {emp.code}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap text-xs text-neutral-600 dark:text-neutral-300">
                        <span className="inline-flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-neutral-400" />
                          {emp.department || '--'}
                        </span>
                      </td>

                      <td>
                        <AttendanceBadge status={emp.status} />
                      </td>

                      <td className="font-mono text-xs whitespace-nowrap">
                        {emp.checkIn ? (
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {formatTime(emp.checkIn)}
                          </span>
                        ) : (
                          <span className="text-neutral-400">--</span>
                        )}
                      </td>

                      <td className="font-mono text-xs whitespace-nowrap">
                        {emp.checkOut ? (
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                            {formatTime(emp.checkOut)}
                          </span>
                        ) : (
                          <span className="text-neutral-400">--</span>
                        )}
                      </td>

                      <td className="font-mono text-xs whitespace-nowrap">
                        {emp.workedHours != null && emp.workedHours > 0 ? (
                          <span className="font-bold text-neutral-900 dark:text-neutral-50">
                            {emp.workedHours.toFixed(1)} hrs
                          </span>
                        ) : (
                          <span className="text-neutral-400">--</span>
                        )}
                      </td>

                      <td className="text-xs text-neutral-600 dark:text-neutral-300 max-w-xs truncate">
                        {emp.hasMissingCheckOut ? (
                          <div className="group relative inline-block">
                            <MissingCheckOutBadge />
                            <div className="opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-2 bg-neutral-900 text-white text-[11px] rounded-lg shadow-lg z-30">
                              <strong>Missing Check-out:</strong> Clocked in on {selectedDateStr} with no check-out before midnight.
                            </div>
                          </div>
                        ) : emp.notes ? (
                          <span title={emp.notes} className="italic text-neutral-500">
                            {emp.notes}
                          </span>
                        ) : (
                          <span className="text-neutral-400">--</span>
                        )}
                      </td>

                      <td className="text-right whitespace-nowrap">
                        <button
                          onClick={() =>
                            setInspectionEmployee({
                              id: emp.id,
                              name: emp.name,
                              code: emp.code,
                              dept: emp.department,
                            })
                          }
                          className="btn btn-ghost btn-sm inline-flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-semibold"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View History</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-neutral-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileSpreadsheet className="h-8 w-8 text-neutral-300 dark:text-neutral-600" />
                        <p className="font-semibold text-neutral-700 dark:text-neutral-300">
                          No roster entries found for {selectedDateStr}
                        </p>
                        <p className="text-xs text-neutral-400 max-w-sm">
                          Try searching for another employee or pick a different date above.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 pt-1">
          <span>
            Displaying <strong>{filteredRoster.length}</strong> roster records for {selectedDateStr}
          </span>
        </div>
      </div>

      {/* Per-Employee History Inspection Modal */}
      {inspectionEmployee && (
        <EmployeeAttendanceModal
          employeeId={inspectionEmployee.id}
          employeeName={inspectionEmployee.name}
          employeeCode={inspectionEmployee.code}
          departmentName={inspectionEmployee.dept}
          onClose={() => setInspectionEmployee(null)}
        />
      )}
    </div>
  );
};
