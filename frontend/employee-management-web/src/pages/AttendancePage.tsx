import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Clock } from 'lucide-react';

export const AttendancePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Management"
        description="View your daily check-in logs, worked durations, and monthly attendance history."
      />
      <EmptyState
        title="Attendance Records"
        description="Use the check-in button in the top bar to record your presence for today. Full attendance log tables will appear here."
        icon={Clock}
      />
    </div>
  );
};
