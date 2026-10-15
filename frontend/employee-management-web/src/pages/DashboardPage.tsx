import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { EmployeeDashboardView } from '@/components/dashboard/EmployeeDashboardView';
import { ManagerDashboardView } from '@/components/dashboard/ManagerDashboardView';
import { AdminDashboardView } from '@/components/dashboard/AdminDashboardView';
import { AlertCircle, Calendar, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/utils';
import type { EmployeeDashboardDto, ManagerDashboardDto, AdminDashboardDto } from '@/types/dashboard';

// Greeting based on time of day
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard');
      return res.data;
    },
    enabled: !!user,
    staleTime: 60_000, // 1 min
    refetchOnWindowFocus: true,
  });

  const greeting = `${getGreeting()}, ${user?.name?.split(' ')[0] ?? 'there'}`;
  const todayStr = formatDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Quick Action button in header
  const quickAction = (() => {
    if (user?.role === 'Employee' || user?.role === 'EMPLOYEE') {
      const empData = data as EmployeeDashboardDto | undefined;
      const state = empData?.todayAttendance?.state;
      if (state === 'NOT_CHECKED_IN') {
        return (
          <button
            className="btn btn-primary btn-md"
            onClick={() => api.post('/attendance/check-in').then(() => window.location.reload())}
          >
            <LogIn className="h-4 w-4" />
            Check In Now
          </button>
        );
      }
    }
    return (
      <Link to="/leave" className="btn btn-secondary btn-md">
        <Calendar className="h-4 w-4" />
        Apply for Leave
      </Link>
    );
  })();

  return (
    <div className="space-y-6 page-enter">
      {/* Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50">
            {greeting} 👋
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {todayStr}
            {user?.departmentId && <span className="ml-2 text-neutral-400 dark:text-neutral-500">· {user?.role}</span>}
          </p>
        </div>
        <div className="flex-shrink-0">{quickAction}</div>
      </div>

      {/* Error State */}
      {error && (
        <div className="card p-6 border-rose-200 dark:border-rose-900">
          <EmptyState
            title="Dashboard Unavailable"
            description={getErrorMessage(error)}
            icon={AlertCircle}
            action={
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            }
          />
        </div>
      )}

      {/* Loading */}
      {isLoading && !error && <DetailSkeleton />}

      {/* Role-specific views */}
      {!isLoading && !error && data && (
        <>
          {(user?.role === 'Admin' || user?.role === 'ADMIN') && (
            <AdminDashboardView data={data as AdminDashboardDto} isLoading={false} />
          )}
          {(user?.role === 'Manager' || user?.role === 'MANAGER') && (
            <ManagerDashboardView data={data as ManagerDashboardDto} isLoading={false} />
          )}
          {(user?.role === 'Employee' || user?.role === 'EMPLOYEE') && (
            <EmployeeDashboardView data={data as EmployeeDashboardDto} isLoading={false} />
          )}
          {/* Fallback if role is unrecognized */}
          {!['Admin', 'ADMIN', 'Manager', 'MANAGER', 'Employee', 'EMPLOYEE'].includes(user?.role ?? '') && (
            <EmptyState
              title="Unknown Role"
              description={`Your account role "${user?.role}" is not recognized. Please contact your administrator.`}
              icon={AlertCircle}
            />
          )}
        </>
      )}
    </div>
  );
};
