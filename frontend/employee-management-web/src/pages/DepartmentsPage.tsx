import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Building2 } from 'lucide-react';

export const DepartmentsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Organize company departments and assign department managers."
      />
      <EmptyState
        title="Departments Directory"
        description="Engineering, Product, Design, Finance, and Human Resources departments."
        icon={Building2}
      />
    </div>
  );
};
