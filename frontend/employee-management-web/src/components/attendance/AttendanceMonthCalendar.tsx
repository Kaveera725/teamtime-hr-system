import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  AlertTriangle,
  Calendar as CalendarIcon,
  FileText,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  isWeekend,
  getDay,
} from 'date-fns';
import { AttendanceBadge } from '@/components/ui/StatusBadge';
import { formatTime } from '@/lib/utils';
import type { AttendanceDto } from '@/types/api';

interface AttendanceMonthCalendarProps {
  currentDate: Date;
  onMonthChange: (newDate: Date) => void;
  records: AttendanceDto[];
  isLoading?: boolean;
}

export const AttendanceMonthCalendar: React.FC<AttendanceMonthCalendarProps> = ({
  currentDate,
  onMonthChange,
  records,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Build lookup map by YYYY-MM-DD
  const recordMap = React.useMemo(() => {
    const map = new Map<string, AttendanceDto>();
    for (const r of records) {
      const key = r.attendanceDate || r.date;
      if (key) {
        map.set(key, r);
      }
    }
    return map;
  }, [records]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Compute leading empty padding for Monday start (0=Sun, 1=Mon, ..., 6=Sat)
  const startDay = getDay(monthStart);
  // In Monday-start week: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
  const leadingOffset = (startDay + 6) % 7;

  const handlePrevMonth = () => {
    onMonthChange(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    const today = new Date();
    onMonthChange(today);
    setSelectedDate(today);
  };

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedRecord = recordMap.get(selectedDateKey);
  const isSelectedWeekend = isWeekend(selectedDate);

  // Status dot color helper
  const getStatusColor = (record?: AttendanceDto, weekend?: boolean) => {
    if (!record) {
      if (weekend) return 'bg-neutral-300 dark:bg-neutral-700';
      return null;
    }

    const s = (record.status || '').toUpperCase();
    if (s === 'PRESENT') return 'bg-emerald-500';
    if (s === 'LATE') return 'bg-amber-500';
    if (s === 'HALF_DAY') return 'bg-sky-500';
    if (s === 'ABSENT') return 'bg-rose-500';
    if (s === 'ON_LEAVE') return 'bg-violet-500';
    if (weekend) return 'bg-neutral-400 dark:bg-neutral-600';
    return 'bg-neutral-400';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Calendar Grid Section */}
      <div className="lg:col-span-8 card p-5 sm:p-6 space-y-5">
        {/* Month Switcher Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
              title="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
              title="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wider py-1">
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div className="text-amber-500/80">Sat</div>
          <div className="text-amber-500/80">Sun</div>
        </div>

        {/* Calendar Day Cells */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {/* Leading empty padding */}
          {Array.from({ length: leadingOffset }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-[64px] sm:min-h-[82px] rounded-xl bg-neutral-50/50 dark:bg-neutral-900/30 border border-transparent opacity-40 pointer-events-none"
            />
          ))}

          {/* Days in Month */}
          {daysInMonth.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const record = recordMap.get(dateStr);
            const weekend = isWeekend(day);
            const today = isToday(day);
            const isSelected = format(selectedDate, 'yyyy-MM-dd') === dateStr;
            const dotColor = getStatusColor(record, weekend);

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(day)}
                type="button"
                className={`min-h-[68px] sm:min-h-[86px] p-1.5 sm:p-2 rounded-xl text-left flex flex-col justify-between transition-all relative border ${
                  isSelected
                    ? 'ring-2 ring-primary-500 border-primary-500 bg-primary-50/40 dark:bg-primary-950/30'
                    : today
                    ? 'border-primary-400 bg-primary-50/20 dark:bg-primary-950/15'
                    : weekend
                    ? 'bg-neutral-50/60 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800/50 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/60'
                    : 'bg-white dark:bg-neutral-900/80 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm'
                }`}
              >
                {/* Day Header (Day number & Today dot) */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs sm:text-sm font-bold ${
                      today
                        ? 'text-primary-600 dark:text-primary-400 font-extrabold'
                        : weekend
                        ? 'text-neutral-400 dark:text-neutral-500'
                        : 'text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>

                  {today && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-500" title="Today" />
                  )}

                  {record?.hasMissingCheckOut && (
                    <span
                      className="text-amber-500"
                      title="Missing check-out"
                    >
                      <AlertTriangle className="h-3 w-3" />
                    </span>
                  )}
                </div>

                {/* Day Status Pill / Dot */}
                <div className="mt-auto pt-1 w-full flex items-center justify-between gap-1">
                  {dotColor ? (
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dotColor}`} />
                      <span className="hidden sm:inline text-[10px] font-medium text-neutral-600 dark:text-neutral-400 truncate capitalize">
                        {record?.status ? record.status.toLowerCase().replace('_', ' ') : weekend ? 'Weekend' : ''}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-neutral-300 dark:text-neutral-600">--</span>
                  )}

                  {record?.workedHours != null && record.workedHours > 0 && (
                    <span className="hidden sm:inline text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                      {record.workedHours.toFixed(1)}h
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>Late</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            <span>Half Day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
            <span>On Leave</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" />
            <span>Weekend</span>
          </div>
        </div>
      </div>

      {/* Day Details Side Panel */}
      <div className="lg:col-span-4 card p-5 sm:p-6 space-y-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm sticky top-20">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
          <div className="space-y-0.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
              Day Breakdown
            </span>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
              {format(selectedDate, 'EEEE, MMM d, yyyy')}
            </h3>
          </div>
          {isToday(selectedDate) && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
              Today
            </span>
          )}
        </div>

        {/* Selected Record Content */}
        {selectedRecord ? (
          <div className="space-y-4">
            {/* Status & Badge */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500 dark:text-neutral-400">Recorded Status:</span>
              <AttendanceBadge status={selectedRecord.status} />
            </div>

            {/* Check-in & Check-out details */}
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 font-medium">
                  <LogIn className="h-4 w-4 text-emerald-500" />
                  Clock In
                </span>
                <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                  {selectedRecord.checkIn ? formatTime(selectedRecord.checkIn) : '--:--'}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 font-medium">
                  <LogOut className="h-4 w-4 text-amber-500" />
                  Clock Out
                </span>
                <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                  {selectedRecord.checkOut ? formatTime(selectedRecord.checkOut) : '--:--'}
                </span>
              </div>

              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 font-medium">
                  <Clock className="h-4 w-4 text-primary-500" />
                  Total Worked
                </span>
                <span className="font-mono font-bold text-neutral-900 dark:text-neutral-50">
                  {selectedRecord.workedHours != null
                    ? `${selectedRecord.workedHours.toFixed(1)} hrs`
                    : selectedRecord.checkIn && !selectedRecord.checkOut
                    ? 'In progress'
                    : '0.0 hrs'}
                </span>
              </div>
            </div>

            {/* Missing Check-out Alert */}
            {selectedRecord.hasMissingCheckOut && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <span>Missing Check-out Detected</span>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  A check-in was logged for this working day, but no check-out was recorded before the end of the day. Contact HR or your team manager for assistance.
                </p>
              </div>
            )}

            {/* Notes Section */}
            {selectedRecord.notes && (
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700/60 space-y-1">
                <span className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 flex items-center gap-1.5">
                  <FileText className="h-3 w-3" />
                  Log Note:
                </span>
                <p className="text-xs text-neutral-700 dark:text-neutral-300 italic">
                  "{selectedRecord.notes}"
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {isSelectedWeekend ? 'Weekend / Non-working Day' : 'No Attendance Record'}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-[220px] mx-auto">
                {isSelectedWeekend
                  ? 'Standard rest day. No check-in was expected or recorded.'
                  : 'No attendance activity recorded for this date.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
