import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { DataTable, Column } from '@/components/ui/DataTable';
import { AttendanceBadge, LeaveBadge } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { FormField } from '@/components/ui/FormField';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { CardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import {
  Users,
  Calendar,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface SampleEmployee {
  id: string;
  name: string;
  department: string;
  role: string;
  attendance: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT';
  leave: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
}

const sampleData: SampleEmployee[] = [
  { id: 'EMP-001', name: 'Alice Walker', department: 'Engineering', role: 'Staff Engineer', attendance: 'PRESENT', leave: 'APPROVED' },
  { id: 'EMP-002', name: 'Bob Roberts', department: 'Product', role: 'Product Manager', attendance: 'LATE', leave: 'PENDING' },
  { id: 'EMP-003', name: 'Catherine Zeta', department: 'Design', role: 'Senior Designer', attendance: 'HALF_DAY', leave: 'REJECTED' },
  { id: 'EMP-004', name: 'David Miller', department: 'Engineering', role: 'DevOps Engineer', attendance: 'ABSENT', leave: 'CANCELLED' },
  { id: 'EMP-005', name: 'Elena Rostova', department: 'Human Resources', role: 'HR Specialist', attendance: 'PRESENT', leave: 'APPROVED' },
  { id: 'EMP-006', name: 'Felix Chen', department: 'Finance', role: 'Financial Analyst', attendance: 'PRESENT', leave: 'PENDING' },
];

export const DesignPage: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogVariant, setDialogVariant] = useState<'primary' | 'warning' | 'danger'>('danger');
  const [startDate, setStartDate] = useState('2026-10-01');
  const [endDate, setEndDate] = useState('2026-10-31');
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');

  const tableColumns: Column<SampleEmployee>[] = [
    {
      key: 'name',
      header: 'Employee',
      sortable: true,
      accessor: (item) => (
        <div className="flex items-center gap-3">
          <Avatar name={item.name} size="sm" />
          <div>
            <div className="font-semibold text-neutral-900 dark:text-neutral-100">{item.name}</div>
            <div className="text-xs text-neutral-500">{item.id}</div>
          </div>
        </div>
      ),
    },
    { key: 'department', header: 'Department', sortable: true },
    { key: 'role', header: 'Position', sortable: true },
    {
      key: 'attendance',
      header: 'Attendance',
      sortable: true,
      accessor: (item) => <AttendanceBadge status={item.attendance} />,
    },
    {
      key: 'leave',
      header: 'Latest Leave',
      sortable: true,
      accessor: (item) => <LeaveBadge status={item.leave} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: () => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDialogVariant('danger');
            setIsDialogOpen(true);
          }}
          className="btn btn-ghost btn-sm text-rose-600 hover:text-rose-700"
          title="Delete record"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-10">
      {/* Page Header */}
      <PageHeader
        title="Design System & Component Showcase"
        description="Comprehensive reference for color tokens, status badges, typography, cards, and shared UI patterns in both light & dark themes."
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Design System' },
        ]}
        actions={
          <>
            <button
              onClick={() => {
                setDialogVariant('primary');
                setIsDialogOpen(true);
              }}
              className="btn btn-secondary btn-md"
            >
              <Sparkles className="h-4 w-4" />
              <span>Modal Demo</span>
            </button>
            <button
              onClick={() => {
                setDialogVariant('danger');
                setIsDialogOpen(true);
              }}
              className="btn btn-primary btn-md"
            >
              <Plus className="h-4 w-4" />
              <span>Trigger Action</span>
            </button>
          </>
        }
      />

      {/* ── 1. Color Palette Tokens ───────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight border-b border-neutral-200 dark:border-neutral-800 pb-2">
          1. Color Palette & Semantic Tokens
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="card p-3 space-y-2">
            <div className="h-12 rounded-md bg-indigo-600 shadow-inner flex items-center justify-center text-white font-bold text-xs">
              Primary (Indigo)
            </div>
            <div className="text-xs font-semibold">Indigo 600</div>
            <div className="text-[10px] text-neutral-400 font-mono">#4f46e5</div>
          </div>
          <div className="card p-3 space-y-2">
            <div className="h-12 rounded-md bg-emerald-600 shadow-inner flex items-center justify-center text-white font-bold text-xs">
              Success (Emerald)
            </div>
            <div className="text-xs font-semibold">Emerald 600</div>
            <div className="text-[10px] text-neutral-400 font-mono">#059669</div>
          </div>
          <div className="card p-3 space-y-2">
            <div className="h-12 rounded-md bg-amber-500 shadow-inner flex items-center justify-center text-white font-bold text-xs">
              Warning (Amber)
            </div>
            <div className="text-xs font-semibold">Amber 500</div>
            <div className="text-[10px] text-neutral-400 font-mono">#f59e0b</div>
          </div>
          <div className="card p-3 space-y-2">
            <div className="h-12 rounded-md bg-rose-600 shadow-inner flex items-center justify-center text-white font-bold text-xs">
              Danger (Rose)
            </div>
            <div className="text-xs font-semibold">Rose 600</div>
            <div className="text-[10px] text-neutral-400 font-mono">#e11d48</div>
          </div>
          <div className="card p-3 space-y-2">
            <div className="h-12 rounded-md bg-sky-600 shadow-inner flex items-center justify-center text-white font-bold text-xs">
              Info (Sky)
            </div>
            <div className="text-xs font-semibold">Sky 600</div>
            <div className="text-[10px] text-neutral-400 font-mono">#0284c7</div>
          </div>
          <div className="card p-3 space-y-2">
            <div className="h-12 rounded-md bg-slate-800 shadow-inner flex items-center justify-center text-white font-bold text-xs">
              Neutral (Slate)
            </div>
            <div className="text-xs font-semibold">Slate 800</div>
            <div className="text-[10px] text-neutral-400 font-mono">#1e293b</div>
          </div>
        </div>
      </section>

      {/* ── 2. Status Badges ─────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight border-b border-neutral-200 dark:border-neutral-800 pb-2">
          2. Fixed Status Badges (Never Color Alone: Icon + Label)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
              Attendance Statuses
            </h3>
            <div className="flex flex-wrap gap-2.5 items-center">
              <AttendanceBadge status="PRESENT" />
              <AttendanceBadge status="LATE" />
              <AttendanceBadge status="HALF_DAY" />
              <AttendanceBadge status="ABSENT" />
            </div>
          </div>
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
              Leave Request Statuses
            </h3>
            <div className="flex flex-wrap gap-2.5 items-center">
              <LeaveBadge status="PENDING" />
              <LeaveBadge status="APPROVED" />
              <LeaveBadge status="REJECTED" />
              <LeaveBadge status="CANCELLED" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Stat Cards ────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight border-b border-neutral-200 dark:border-neutral-800 pb-2">
          3. Stat Cards with Accent Borders & Metrics
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Employees"
            value="24"
            icon={Users}
            accent="primary"
            change={{ value: '+4', isPositive: true, period: 'last month' }}
          />
          <StatCard
            label="Present Today"
            value="19 / 24"
            icon={CheckCircle2}
            accent="success"
            subtitle="79% attendance rate"
          />
          <StatCard
            label="Pending Leave"
            value="3"
            icon={Calendar}
            accent="warning"
            subtitle="Requires manager action"
          />
          <StatCard
            label="Absences"
            value="2"
            icon={AlertTriangle}
            accent="danger"
            change={{ value: '+1', isPositive: false, period: 'yesterday' }}
          />
        </div>
      </section>

      {/* ── 4. Buttons & Form Fields ───────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight border-b border-neutral-200 dark:border-neutral-800 pb-2">
          4. Buttons, Forms, & Controls
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Buttons & Sizes
            </h3>
            <div className="flex flex-wrap gap-2 items-center">
              <button className="btn btn-primary btn-sm">Primary Small</button>
              <button className="btn btn-primary btn-md">Primary Medium</button>
              <button className="btn btn-primary btn-lg">Primary Large</button>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button className="btn btn-secondary btn-md">Secondary</button>
              <button className="btn btn-ghost btn-md">Ghost</button>
              <button className="btn btn-danger btn-md">Danger</button>
              <button className="btn btn-secondary btn-md" disabled>
                Disabled
              </button>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              FormField with Inline Errors & Hints
            </h3>
            <FormField
              label="Employee Email"
              htmlFor="demo-email"
              required
              hint="Must be an internal company email"
              error={inputError}
            >
              <input
                id="demo-email"
                type="email"
                placeholder="name@teamtime.com"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (e.target.value && !e.target.value.includes('@')) {
                    setInputError('Please enter a valid email address.');
                  } else {
                    setInputError('');
                  }
                }}
                className={`input ${inputError ? 'input-error' : ''}`}
              />
            </FormField>

            <DateRangePicker
              label="Date Range Filter"
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
            />
          </div>
        </div>
      </section>

      {/* ── 5. Avatars ────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight border-b border-neutral-200 dark:border-neutral-800 pb-2">
          5. Avatars with Initials & Dynamic Hues
        </h2>
        <div className="card p-5 flex flex-wrap gap-4 items-center">
          <Avatar name="Sarah Connor" size="xs" />
          <Avatar name="John Doe" size="sm" />
          <Avatar name="Kaveera Fernando" size="md" />
          <Avatar name="Anushka Shan" size="lg" />
          <Avatar name="Administrator TeamTime" size="xl" />
        </div>
      </section>

      {/* ── 6. DataTable ──────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight border-b border-neutral-200 dark:border-neutral-800 pb-2">
          6. Interactive DataTable (Sortable, Paginated)
        </h2>
        <DataTable
          columns={tableColumns}
          data={sampleData}
          pageSize={4}
          onRowClick={(item) => console.log('Clicked', item)}
        />
      </section>

      {/* ── 7. Skeleton Loaders ───────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight border-b border-neutral-200 dark:border-neutral-800 pb-2">
          7. Shimmer Skeleton Loaders
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton rows={3} cols={4} />
      </section>

      {/* ── 8. Empty State ────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight border-b border-neutral-200 dark:border-neutral-800 pb-2">
          8. Empty State Pattern
        </h2>
        <EmptyState
          title="No Leave Applications Found"
          description="You haven't submitted any leave applications for this period. Click below to submit your first request."
          icon={Calendar}
          action={
            <button className="btn btn-primary btn-md">
              <Plus className="h-4 w-4" />
              <span>Apply for Leave</span>
            </button>
          }
        />
      </section>

      {/* ConfirmDialog Modal */}
      <ConfirmDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onConfirm={() => {
          setIsDialogOpen(false);
          alert('Action confirmed!');
        }}
        title={dialogVariant === 'danger' ? 'Deactivate Employee?' : 'Confirm Approval'}
        description={
          dialogVariant === 'danger'
            ? 'Are you sure you want to deactivate this employee? They will no longer be able to log in or submit leave.'
            : 'Are you sure you want to approve this request? The leave balance will be updated immediately.'
        }
        confirmText={dialogVariant === 'danger' ? 'Deactivate' : 'Approve'}
        variant={dialogVariant}
      />
    </div>
  );
};
