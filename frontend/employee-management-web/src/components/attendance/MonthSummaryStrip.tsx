import React from 'react';
import {
  CheckCircle2,
  Clock,
  Timer,
  AlertOctagon,
} from 'lucide-react';
import type { AttendanceDto } from '@/types/api';

interface MonthSummaryStripProps {
  records: AttendanceDto[];
  isLoading?: boolean;
}

export const MonthSummaryStrip: React.FC<MonthSummaryStripProps> = ({ records, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card p-4 space-y-2">
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-8 w-16 rounded" />
            <div className="skeleton h-3 w-32 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Calculate stats from attendance records
  let presentDays = 0;
  let lateDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let onLeaveDays = 0;
  let totalWorkedHours = 0;
  let daysWithHours = 0;

  for (const r of records) {
    const status = (r.status || '').toUpperCase();
    if (status === 'PRESENT') {
      presentDays++;
    } else if (status === 'LATE') {
      lateDays++;
      presentDays++; // Late employees are still present
    } else if (status === 'HALF_DAY') {
      halfDays++;
      presentDays++;
    } else if (status === 'ABSENT') {
      absentDays++;
    } else if (status === 'ON_LEAVE') {
      onLeaveDays++;
    }

    if (r.workedHours && r.workedHours > 0) {
      totalWorkedHours += r.workedHours;
      daysWithHours++;
    }
  }

  const avgHours = daysWithHours > 0 ? (totalWorkedHours / daysWithHours).toFixed(1) : '0.0';

  const stats = [
    {
      title: 'Days Present',
      value: presentDays,
      subtext: halfDays > 0 ? `${halfDays} half-day included` : 'Recorded this month',
      icon: CheckCircle2,
      accent: 'border-t-emerald-500',
      iconColor: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50',
      badge: `${totalWorkedHours.toFixed(0)} total hrs`,
    },
    {
      title: 'Late Check-ins',
      value: lateDays,
      subtext: lateDays === 0 ? 'Flawless punctuality' : 'After 9:00 AM cutoff',
      icon: Clock,
      accent: 'border-t-amber-500',
      iconColor: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50',
      badge: lateDays > 0 ? 'Notice' : 'On Track',
    },
    {
      title: 'Average Daily Hours',
      value: `${avgHours}h`,
      subtext: 'Target: 8.0 hrs/day',
      icon: Timer,
      accent: 'border-t-primary-500',
      iconColor: 'text-primary-500 bg-primary-50 dark:bg-primary-950/50',
      badge: Number(avgHours) >= 8.0 ? 'Optimal' : 'Standard',
    },
    {
      title: 'Absences',
      value: absentDays,
      subtext: onLeaveDays > 0 ? `+ ${onLeaveDays} approved leave` : 'Unexcused absence',
      icon: AlertOctagon,
      accent: 'border-t-rose-500',
      iconColor: 'text-rose-500 bg-rose-50 dark:bg-rose-950/50',
      badge: absentDays === 0 ? 'Zero Absences' : 'Action Req.',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className={`card p-4 sm:p-5 border-t-4 ${item.accent} hover:shadow-md transition-shadow relative overflow-hidden`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                {item.title}
              </span>
              <div className={`p-2 rounded-lg ${item.iconColor}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-neutral-50 tracking-tight">
                {item.value}
              </div>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                {item.badge}
              </span>
            </div>

            <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-2 flex items-center gap-1">
              {item.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
};
