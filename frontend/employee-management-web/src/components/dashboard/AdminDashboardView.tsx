import React from 'react';
import { Users, CheckCircle2, CalendarOff, Clock, Building2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';
import type { AdminDashboardDto } from '@/types/dashboard';

// ── Dark-aware chart colours ──────────────────────────────
const CHART_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#f43f5e',
  '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6',
];

// ── Custom Tooltip ─────────────────────────────────────────
const BarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-neutral-900 dark:bg-neutral-950 text-white text-xs px-3 py-2 rounded-lg shadow-lg border border-neutral-700">
      <div className="font-semibold mb-1">{label}</div>
      <div className="text-indigo-300">{payload[0].value} days</div>
    </div>
  );
};

const DonutTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-neutral-900 dark:bg-neutral-950 text-white text-xs px-3 py-2 rounded-lg shadow-lg border border-neutral-700">
      <div className="font-semibold">{payload[0].name}</div>
      <div className="text-indigo-300">{payload[0].value} employees</div>
    </div>
  );
};

// ── Custom Donut Legend ────────────────────────────────────
const DonutLegend = ({ data }: { data: Array<{ name: string; value: number }> }) => (
  <div className="flex flex-col gap-1.5 justify-center">
    {data.map((entry, i) => (
      <div key={entry.name} className="flex items-center gap-2 text-xs">
        <span
          className="h-2.5 w-2.5 rounded-sm flex-shrink-0"
          style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
        />
        <span className="text-neutral-600 dark:text-neutral-400 truncate max-w-[120px]">{entry.name}</span>
        <span className="font-bold text-neutral-800 dark:text-neutral-200 ml-auto pl-2">{entry.value}</span>
      </div>
    ))}
  </div>
);

// ── Admin Dashboard ────────────────────────────────────────
interface Props {
  data: AdminDashboardDto;
  isLoading: boolean;
}

export const AdminDashboardView: React.FC<Props> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
        <CardSkeleton className="h-40" />
      </div>
    );
  }

  const { todayAttendanceSummary: att } = data;

  // Bar chart data
  const barData = data.leaveDaysPerMonthLast6Months.map(m => ({
    name: m.monthName.slice(0, 3),
    days: Number(m.totalDays),
  }));

  // Donut chart data
  const donutData = data.employeesPerDepartment.map(d => ({
    name: d.departmentName,
    value: d.activeEmployees,
  }));

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Employees"
          value={data.totalEmployees}
          icon={Users}
          accent="primary"
          subtitle={`${data.activeEmployees} active`}
        />
        <StatCard
          label="Present Today"
          value={att.presentCount + att.lateCount}
          icon={CheckCircle2}
          accent="success"
          subtitle={`${att.lateCount} late arrivals`}
        />
        <StatCard
          label="On Leave Today"
          value={att.onLeaveCount}
          icon={CalendarOff}
          accent="info"
          subtitle={`${att.absentCount} absent`}
        />
        <StatCard
          label="Pending Approvals"
          value={data.pendingLeaveCount}
          icon={Clock}
          accent="warning"
          subtitle={`${data.leaveDaysUsedThisMonth} days used this month`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leave Days Bar Chart */}
        <div className="card p-5">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            Leave Days (Last 6 Months)
          </h2>
          <p className="text-xs text-neutral-400 mb-4">Total approved leave days consumed per month.</p>
          {barData.length === 0 ? (
            <EmptyState title="No leave data" description="No leave days recorded in the last 6 months." icon={CalendarOff} className="h-48 border-0 shadow-none bg-transparent" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="currentColor"
                  className="text-neutral-200 dark:text-neutral-800"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-neutral-500 dark:text-neutral-400"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  className="text-neutral-500 dark:text-neutral-400"
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Bar
                  dataKey="days"
                  fill="#6366f1"
                  radius={[5, 5, 0, 0]}
                  name="Leave Days"
                  label={{ position: 'top', fontSize: 10, fill: '#94a3b8' }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Employees Per Department Donut */}
        <div className="card p-5">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            Employees by Department
          </h2>
          <p className="text-xs text-neutral-400 mb-4">Active employees in each department.</p>
          {donutData.length === 0 ? (
            <EmptyState title="No departments" description="No department data available." icon={Building2} className="h-48 border-0 shadow-none bg-transparent" />
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {donutData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        stroke="transparent"
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 min-w-0">
                <DonutLegend data={donutData} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today Attendance Summary bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Today's Attendance Breakdown</h2>
          <Link to="/attendance" className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
            View details <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Present', value: att.presentCount, color: 'bg-emerald-500', textColor: 'text-emerald-700 dark:text-emerald-400' },
            { label: 'Late', value: att.lateCount, color: 'bg-amber-500', textColor: 'text-amber-700 dark:text-amber-400' },
            { label: 'On Leave', value: att.onLeaveCount, color: 'bg-sky-500', textColor: 'text-sky-700 dark:text-sky-400' },
            { label: 'Absent', value: att.absentCount, color: 'bg-rose-500', textColor: 'text-rose-700 dark:text-rose-400' },
          ].map(item => (
            <div key={item.label} className="flex flex-col items-center p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 gap-2 text-center">
              <span className={`text-3xl font-extrabold ${item.textColor}`}>{item.value}</span>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${item.color}`} />
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pending Requests Quick List */}
      {data.pendingLeaveCount > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">
              Pending Leave Requests
              <span className="ml-2 badge badge-pending">{data.pendingLeaveCount}</span>
            </h2>
            <Link to="/leave" className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              Review all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            There {data.pendingLeaveCount === 1 ? 'is' : 'are'}{' '}
            <span className="font-semibold text-amber-600 dark:text-amber-400">{data.pendingLeaveCount}</span>{' '}
            leave request{data.pendingLeaveCount === 1 ? '' : 's'} awaiting your review. Visit the Leave page to approve or reject them.
          </p>
          <div className="mt-3">
            <Link to="/leave" className="btn btn-primary btn-md">
              Go to Leave Requests
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
