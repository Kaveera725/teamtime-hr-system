import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  className?: string;
  label?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  className,
  label,
}) => {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
          {label}
        </span>
      )}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="input text-xs py-1.5 px-2 pl-8"
          />
          <CalendarIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
        </div>
        <span className="text-xs text-neutral-400">to</span>
        <div className="relative flex-1">
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="input text-xs py-1.5 px-2 pl-8"
          />
          <CalendarIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
        </div>
      </div>
    </div>
  );
};
