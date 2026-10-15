import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Users } from 'lucide-react';

export const EmployeesPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee Directory"
        description="Manage company personnel, assign departments, and update roles."
      />
      <EmptyState
        title="Employee Management"
        description="Active employee list, roles, and profiles."
        icon={Users}
      />
    </div>
  );
};
