import React from 'react';
import type { LeaveBalanceDto } from '@/types/api';
import { cn } from '@/lib/utils';
import { Sparkles, AlertCircle } from 'lucide-react';

interface LeaveBalanceCardProps {
  balance: LeaveBalanceDto;
}

const RING_SIZE = 100;
const STROKE = 8;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface TypeTheme {
  stroke: string;
  gradientFrom: string;
  gradientTo: string;
  badgeBg: string;
  textHero: string;
}

const TYPE_THEMES: Record<string, TypeTheme> = {
  annual: {
    stroke: '#10b981',
    gradientFrom: '#10b981',
    gradientTo: '#059669',
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    textHero: 'text-emerald-600 dark:text-emerald-400',
  },
  medical: {
    stroke: '#f43f5e',
    gradientFrom: '#f43f5e',
    gradientTo: '#e11d48',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    textHero: 'text-rose-600 dark:text-rose-400',
  },
  sick: {
    stroke: '#f43f5e',
    gradientFrom: '#f43f5e',
    gradientTo: '#e11d48',
    badgeBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    textHero: 'text-rose-600 dark:text-rose-400',
  },
  casual: {
    stroke: '#f59e0b',
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
    badgeBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    textHero: 'text-amber-600 dark:text-amber-400',
  },
  maternity: {
    stroke: '#8b5cf6',
    gradientFrom: '#8b5cf6',
    gradientTo: '#7c3aed',
    badgeBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    textHero: 'text-purple-600 dark:text-purple-400',
  },
  'no pay': {
    stroke: '#64748b',
    gradientFrom: '#64748b',
    gradientTo: '#475569',
    badgeBg: 'bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
    textHero: 'text-slate-600 dark:text-slate-400',
  },
};

function getTheme(name: string): TypeTheme {
  const lower = name.toLowerCase();
  for (const [key, theme] of Object.entries(TYPE_THEMES)) {
    if (lower.includes(key)) return theme;
  }
  return {
    stroke: '#6366f1',
    gradientFrom: '#6366f1',
    gradientTo: '#4f46e5',
    badgeBg: 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800',
    textHero: 'text-primary-600 dark:text-primary-400',
  };
}

export const LeaveBalanceCard: React.FC<LeaveBalanceCardProps> = ({ balance }) => {
  const theme = getTheme(balance.leaveTypeName);
  const allocated = balance.allocatedDays ?? balance.allocated ?? 0;
  const used = balance.usedDays ?? balance.used ?? 0;
  const pending = balance.pendingDays ?? balance.pending ?? 0;
  const remaining = balance.remainingDays ?? balance.remaining ?? (allocated - used);
  const available = balance.availableDays ?? Math.max(0, remaining - pending);

  const isNoPay = balance.leaveTypeName.toLowerCase().includes('no pay');

  // Ring calculation: percentage of remaining out of allocated
  const ratio = allocated > 0 ? Math.min(Math.max(remaining / allocated, 0), 1) : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - ratio);

  return (
    <div className="card card-hover p-5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden group">
      {/* Decorative top subtle gradient bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{
          background: `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
        }}
      />

      {/* Header with Title and Type badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-base leading-snug">
            {balance.leaveTypeName}
          </h3>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {balance.year} Calendar Year
          </span>
        </div>
        <span
          className={cn(
            'px-2 py-0.5 text-[11px] font-medium rounded-full border flex items-center gap-1 shrink-0',
            theme.badgeBg
          )}
        >
          {isNoPay ? 'Uncapped' : `${allocated}d Total`}
        </span>
      </div>

      {/* Hero Visual Area: Progress Ring & Center Metric */}
      <div className="flex items-center justify-center my-3">
        <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90 transform">
            {/* Background track circle */}
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke="currentColor"
              strokeWidth={STROKE}
              fill="transparent"
              className="text-neutral-100 dark:text-neutral-800"
            />
            {/* Animated progress circle */}
            {!isNoPay && (
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={theme.stroke}
                strokeWidth={STROKE}
                fill="transparent"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            )}
          </svg>

          {/* Center metric */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {isNoPay ? (
              <Sparkles className="h-6 w-6 text-slate-400" />
            ) : (
              <>
                <span className={cn('text-2xl font-black tracking-tight leading-none', theme.textHero)}>
                  {remaining}
                </span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium uppercase tracking-wider mt-0.5">
                  remaining
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Metrics Breakdown Grid */}
      <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">
            <span className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Used
            </span>
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              {used}d
            </span>
          </div>

          <div className="p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">
            <span className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Pending
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {pending}d
            </span>
          </div>

          <div className="p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40">
            <span className="block text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              Available
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {isNoPay ? '∞' : `${available}d`}
            </span>
          </div>
        </div>

        {pending > 0 && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400/90 font-medium">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>{pending} day(s) currently awaiting manager review</span>
          </div>
        )}
      </div>
    </div>
  );
};
