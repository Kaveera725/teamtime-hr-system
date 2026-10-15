import React, { ReactNode } from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatAccent = 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  change?: {
    value: string | number;
    isPositive?: boolean;
    period?: string;
  };
  accent?: StatAccent;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

const accentBorderMap: Record<StatAccent, string> = {
  primary: 'border-t-primary-500',
  success: 'border-t-emerald-500',
  warning: 'border-t-amber-500',
  danger: 'border-t-rose-500',
  info: 'border-t-sky-500',
};

const accentBgMap: Record<StatAccent, string> = {
  primary: 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  danger: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  info: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  change,
  accent = 'primary',
  subtitle,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        'card p-5 border-t-4 transition-all duration-200 hover:shadow-md',
        accentBorderMap[accent],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {label}
        </span>
        {Icon && (
          <div className={cn('p-2 rounded-lg', accentBgMap[accent])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50">
          {value}
        </span>
        {actions}
      </div>

      {(change || subtitle) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {change && (
            <div
              className={cn(
                'inline-flex items-center font-medium gap-0.5',
                change.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}
            >
              {change.isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              <span>{change.value}</span>
            </div>
          )}
          {change?.period && (
            <span className="text-neutral-400 dark:text-neutral-500">
              vs {change.period}
            </span>
          )}
          {subtitle && !change && (
            <span className="text-neutral-500 dark:text-neutral-400">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
