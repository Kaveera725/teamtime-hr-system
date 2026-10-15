import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Calendar } from 'lucide-react';

export const LeavePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Requests"
        description="Submit leave requests, track approvals, and view your remaining balance."
      />
      <EmptyState
        title="No Leave Records"
        description="Submit your first leave request to view pending reviews and approval status."
        icon={Calendar}
      />
    </div>
  );
};
