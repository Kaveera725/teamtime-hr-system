import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user?.name || 'Employee'}`}
        description={`Overview of your workplace attendance, leave requests, and team activity (${user?.role || 'User'}).`}
        actions={
          <Link to="/design" className="btn btn-secondary btn-sm">
            View Design System
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today's Status"
          value="Present"
          icon={CheckCircle2}
          accent="success"
          subtitle="Check-in at 08:52 AM"
        />
        <StatCard
          label="Leave Balance"
          value="14 Days"
          icon={Calendar}
          accent="primary"
          subtitle="Annual Leave remaining"
        />
        <StatCard
          label="Hours Worked"
          value="38.5 hrs"
          icon={Clock}
          accent="info"
          change={{ value: '+2.5', isPositive: true, period: 'last week' }}
        />
        <StatCard
          label="Team Members"
          value="8"
          icon={Users}
          accent="warning"
          subtitle="In your department"
        />
      </div>

      <div className="card p-6 border border-neutral-200 dark:border-neutral-800">
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
          Design System Ready
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          The TeamTime design system and shared UI foundation are fully set up. Explore all color tokens, status badges, tables, and form patterns on the Design System page.
        </p>
        <Link to="/design" className="btn btn-primary btn-md">
          Explore /design Page
        </Link>
      </div>
    </div>
  );
};
