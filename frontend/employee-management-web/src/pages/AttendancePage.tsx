import React, { useState } from 'react';
import {
  Calendar,
  Table as TableIcon,
  Users,
  UserCheck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { CheckInCard } from '@/components/attendance/CheckInCard';
import { MonthSummaryStrip } from '@/components/attendance/MonthSummaryStrip';
import { AttendanceMonthCalendar } from '@/components/attendance/AttendanceMonthCalendar';
import { AttendanceTableView } from '@/components/attendance/AttendanceTableView';
import { TeamAttendanceTab } from '@/components/attendance/TeamAttendanceTab';
import type { TodayAttendanceStateDto, AttendanceDto } from '@/types/api';

export const AttendancePage: React.FC = () => {
  const { user, isAdmin, isManager } = useAuth();
  const canViewTeam = isAdmin || isManager;

  // Active top tab: 'my' or 'team'
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');

  // Sub-view toggle for 'my' attendance: 'calendar' or 'table'
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');

  // Calendar month state
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(new Date());

  // Table view date range state (defaults to last 30 days)
  const today = new Date();
  const [tableFromDate, setTableFromDate] = useState<string>(
    format(subDays(today, 30), 'yyyy-MM-dd')
  );
  const [tableToDate, setTableToDate] = useState<string>(
    format(today, 'yyyy-MM-dd')
  );

  // 1. Fetch Today's Attendance State for Current User
  const {
    data: todayState,
    isLoading: isTodayLoading,
  } = useQuery<TodayAttendanceStateDto>({
    queryKey: ['attendanceToday'],
    queryFn: async () => {
      const res = await api.get<TodayAttendanceStateDto>('/attendance/my/today');
      return res.data;
    },
    enabled: !!user,
  });

  // 2. Fetch Month Records for Calendar & Month Summary Strip
  const monthStartStr = format(startOfMonth(calendarMonthDate), 'yyyy-MM-dd');
  const monthEndStr = format(endOfMonth(calendarMonthDate), 'yyyy-MM-dd');

  const {
    data: monthRecords = [],
    isLoading: isMonthLoading,
  } = useQuery<AttendanceDto[]>({
    queryKey: ['attendanceMyMonth', monthStartStr, monthEndStr],
    queryFn: async () => {
      const res = await api.get<AttendanceDto[]>('/attendance/my', {
        params: { from: monthStartStr, to: monthEndStr },
      });
      return res.data;
    },
    enabled: !!user,
  });

  // 3. Fetch Range Records for Detailed Table View
  const {
    data: tableRecords = [],
    isLoading: isTableLoading,
  } = useQuery<AttendanceDto[]>({
    queryKey: ['attendanceMyTable', tableFromDate, tableToDate],
    queryFn: async () => {
      const res = await api.get<AttendanceDto[]>('/attendance/my', {
        params: { from: tableFromDate, to: tableToDate },
      });
      return res.data;
    },
    enabled: !!user && viewMode === 'table',
  });

  return (
    <div className="space-y-6 page-enter">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Attendance Management"
          description="Log daily check-ins, track worked hours, review calendar status, and inspect attendance audits."
        />

        {/* Manager/Admin Top Level Tabs */}
        {canViewTeam && (
          <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 self-start sm:self-center shadow-inner">
            <button
              onClick={() => setActiveTab('my')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'my'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <UserCheck className="h-4 w-4 text-emerald-500" />
              <span>My Attendance</span>
            </button>

            <button
              onClick={() => setActiveTab('team')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'team'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              <Users className="h-4 w-4 text-primary-500" />
              <span>Team Roster & Logs</span>
            </button>
          </div>
        )}
      </div>

      {/* Tab: My Attendance */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {/* Prominent Check-in Terminal Card */}
          <CheckInCard todayState={todayState} isLoading={isTodayLoading} />

          {/* Month Summary Strip */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
                Monthly Performance Overview ({format(calendarMonthDate, 'MMMM yyyy')})
              </h3>
            </div>
            <MonthSummaryStrip records={monthRecords} isLoading={isMonthLoading} />
          </div>

          {/* View Toggle Bar (Month Calendar vs Detailed Table) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Attendance Records & Logs
              </h3>
            </div>

            {/* Segmented View Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 self-start sm:self-auto border border-neutral-200 dark:border-neutral-700">
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'calendar'
                    ? 'bg-white dark:bg-neutral-900 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Month Calendar</span>
              </button>

              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-neutral-900 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>Detailed Table</span>
              </button>
            </div>
          </div>

          {/* View Mode: Month Calendar View */}
          {viewMode === 'calendar' && (
            <AttendanceMonthCalendar
              currentDate={calendarMonthDate}
              onMonthChange={setCalendarMonthDate}
              records={monthRecords}
              isLoading={isMonthLoading}
            />
          )}

          {/* View Mode: Detailed Table View */}
          {viewMode === 'table' && (
            <AttendanceTableView
              records={tableRecords}
              fromDate={tableFromDate}
              toDate={tableToDate}
              onDateRangeChange={(from, to) => {
                setTableFromDate(from);
                setTableToDate(to);
              }}
              isLoading={isTableLoading}
            />
          )}
        </div>
      )}

      {/* Tab: Team Attendance (Managers / Admins) */}
      {activeTab === 'team' && canViewTeam && (
        <TeamAttendanceTab />
      )}
    </div>
  );
};
