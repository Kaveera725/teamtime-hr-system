import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isWeekend,
  isBefore,
  isAfter,
  parseISO,
  addDays,
  subDays,
} from 'date-fns';
import { cn } from '@/lib/utils';

interface LeaveDateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  isMedicalLeave?: boolean;
  className?: string;
}

export const LeaveDateRangePicker: React.FC<LeaveDateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
  isMedicalLeave = false,
  className,
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // BR-09: Medical Leave allows up to 3 days backdating; others must be today or future
  const minAllowedDate = isMedicalLeave ? subDays(today, 3) : today;

  // Month navigation for visual picker
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    if (startDate) {
      try {
        return parseISO(startDate);
      } catch {
        return today;
      }
    }
    return today;
  });

  const parsedStart = startDate ? parseISO(startDate) : null;
  const parsedEnd = endDate ? parseISO(endDate) : null;

  // Track selection state for click-to-range
  const [selectionStep, setSelectionStep] = useState<'start' | 'end'>('start');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const isDateDisabled = (date: Date) => {
    // 1. Check weekends (Sat/Sun)
    if (isWeekend(date)) return true;

    // 2. Check past dates
    const dateZero = new Date(date);
    dateZero.setHours(0, 0, 0, 0);
    if (isBefore(dateZero, minAllowedDate)) return true;

    // 3. BR-08 single calendar year: if start date is selected and we're picking end date, must be same year
    if (selectionStep === 'end' && parsedStart && date.getFullYear() !== parsedStart.getFullYear()) {
      return true;
    }

    return false;
  };

  const handleDayClick = (date: Date) => {
    if (isDateDisabled(date)) return;

    const dateStr = format(date, 'yyyy-MM-dd');

    if (selectionStep === 'start' || !parsedStart) {
      onChange(dateStr, dateStr);
      setSelectionStep('end');
    } else {
      // Step is 'end'
      if (isBefore(date, parsedStart)) {
        // If user clicked before start, make it new start
        onChange(dateStr, dateStr);
        setSelectionStep('end');
      } else if (date.getFullYear() !== parsedStart.getFullYear()) {
        // Prevent cross year
        return;
      } else {
        onChange(startDate, dateStr);
        setSelectionStep('start');
      }
    }
  };

  // Quick preset shortcuts
  const selectSingleDay = (targetDate: Date) => {
    if (isDateDisabled(targetDate)) return;
    const s = format(targetDate, 'yyyy-MM-dd');
    onChange(s, s);
    setSelectionStep('start');
  };

  const selectNextWeek = () => {
    let nextMon = addDays(today, (8 - today.getDay()) % 7 || 7);
    if (isWeekend(nextMon)) {
      nextMon = addDays(nextMon, 1);
    }
    const nextFri = addDays(nextMon, 4);
    onChange(format(nextMon, 'yyyy-MM-dd'), format(nextFri, 'yyyy-MM-dd'));
    setSelectionStep('start');
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Top quick inputs and status indicators */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            Start Date <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="date"
              value={startDate}
              min={format(minAllowedDate, 'yyyy-MM-dd')}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                const d = parseISO(val);
                if (isWeekend(d)) return;
                // If end date is earlier or in different year, sync it
                if (!endDate || endDate < val || parseISO(endDate).getFullYear() !== d.getFullYear()) {
                  onChange(val, val);
                } else {
                  onChange(val, endDate);
                }
              }}
              className="input text-xs py-2 px-3 pl-8 font-medium"
            />
            <CalendarIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            End Date <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="date"
              value={endDate}
              min={startDate || format(minAllowedDate, 'yyyy-MM-dd')}
              max={startDate ? `${parseISO(startDate).getFullYear()}-12-31` : undefined}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                const d = parseISO(val);
                if (isWeekend(d)) return;
                if (startDate && d.getFullYear() !== parseISO(startDate).getFullYear()) return;
                onChange(startDate || val, val);
              }}
              className="input text-xs py-2 px-3 pl-8 font-medium"
            />
            <CalendarIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          </div>
        </div>
      </div>

      {/* Quick Preset Buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-neutral-500 font-medium mr-1">Presets:</span>
        <button
          type="button"
          onClick={() => {
            const d = isWeekend(today) ? addDays(today, today.getDay() === 6 ? 2 : 1) : today;
            selectSingleDay(d);
          }}
          className="px-2 py-0.5 rounded text-[11px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors font-medium"
        >
          {isWeekend(today) ? 'Next Workday' : 'Today'}
        </button>
        <button
          type="button"
          onClick={() => {
            let tomorrow = addDays(today, 1);
            if (isWeekend(tomorrow)) {
              tomorrow = addDays(today, today.getDay() === 5 ? 3 : 2);
            }
            selectSingleDay(tomorrow);
          }}
          className="px-2 py-0.5 rounded text-[11px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors font-medium"
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={selectNextWeek}
          className="px-2 py-0.5 rounded text-[11px] bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors font-medium"
        >
          Full Next Week (Mon-Fri)
        </button>
      </div>

      {/* Interactive Calendar Month Picker */}
      <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/60">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            type="button"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Day headers Mon - Sun */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 mb-1">
          <span>Mo</span>
          <span>Tu</span>
          <span>We</span>
          <span>Th</span>
          <span>Fr</span>
          <span className="text-rose-400 dark:text-rose-500">Sa</span>
          <span className="text-rose-400 dark:text-rose-500">Su</span>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            const isCurrMonth = isSameMonth(day, currentMonth);
            const weekend = isWeekend(day);
            const disabled = isDateDisabled(day);
            const isStart = parsedStart && isSameDay(day, parsedStart);
            const isEnd = parsedEnd && isSameDay(day, parsedEnd);
            const inRange =
              parsedStart &&
              parsedEnd &&
              isAfter(day, parsedStart) &&
              isBefore(day, parsedEnd) &&
              !weekend;

            const isToday = isSameDay(day, today);

            return (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => handleDayClick(day)}
                title={
                  weekend
                    ? 'Weekend (Non-working day)'
                    : disabled
                    ? 'Disabled date (Past date or year boundary)'
                    : format(day, 'MMM d, yyyy')
                }
                className={cn(
                  'h-7 w-full flex items-center justify-center text-[11px] rounded transition-all select-none relative',
                  !isCurrMonth && 'opacity-30',
                  weekend && 'opacity-40 cursor-not-allowed bg-neutral-100/40 dark:bg-neutral-800/20 text-neutral-400',
                  disabled && !weekend && 'opacity-30 cursor-not-allowed line-through text-neutral-400',
                  !disabled && !weekend && 'hover:bg-primary-100 dark:hover:bg-primary-950/60 font-medium',
                  isToday && !isStart && !isEnd && 'border border-primary-500/50 font-bold',
                  inRange && 'bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 font-semibold',
                  (isStart || isEnd) &&
                    'bg-primary-600 text-white font-bold shadow-sm hover:bg-primary-700 hover:text-white'
                )}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 pt-2 border-t border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between text-[10px] text-neutral-400">
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary-600 inline-block" />
            <span>Selected Range</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded bg-neutral-200 dark:bg-neutral-800 inline-block" />
            <span>Weekend (Excluded)</span>
          </div>
          {isMedicalLeave && (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-3 w-3" />
              <span>Backdating allowed (3d)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
