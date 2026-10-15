import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const UnauthorizedPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Access Denied"
        description="You do not have permission to view this resource."
      />
      <EmptyState
        title="403 - Forbidden"
        description="Your current role does not grant access to this page. Please contact your administrator if you believe this is a mistake."
        icon={ShieldAlert}
        action={
          <Link to="/dashboard" className="btn btn-primary btn-md">
            Return to Dashboard
          </Link>
        }
      />
    </div>
  );
};
