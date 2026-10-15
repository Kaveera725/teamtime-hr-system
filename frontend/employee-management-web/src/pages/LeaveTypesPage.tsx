import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Settings } from 'lucide-react';

export const LeaveTypesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Types Configuration"
        description="Configure available leave types, default allocations, and documentation policies."
      />
      <EmptyState
        title="Leave Types Settings"
        description="Annual Leave, Sick Leave, Maternity Leave, Casual Leave, and No-Pay Leave policies."
        icon={Settings}
      />
    </div>
  );
};
