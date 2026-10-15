import React, { ReactNode } from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No data available',
  description = 'There are no records to display at this moment.',
  icon: Icon = Inbox,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        'card flex flex-col items-center justify-center p-8 text-center sm:p-12',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};
