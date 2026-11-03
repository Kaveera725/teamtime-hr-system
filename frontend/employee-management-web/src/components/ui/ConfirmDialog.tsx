import React, { ReactNode } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  children?: ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isLoading = false,
  children,
}) => {
  const dialogRef = useDialogAccessibility<HTMLDivElement>({
    isOpen,
    onClose,
    closeOnEsc: !isLoading,
  });

  if (!isOpen) return null;

  const btnVariants = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white focus-visible:ring-rose-500',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white focus-visible:ring-amber-500',
    primary: 'bg-primary-600 hover:bg-primary-700 text-white focus-visible:ring-primary-500',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md card p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 animate-in zoom-in-95 duration-150"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
              variant === 'danger' && 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400',
              variant === 'warning' && 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
              variant === 'primary' && 'bg-primary-100 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400'
            )}
          >
            {variant === 'danger' || variant === 'warning' ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <Info className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1">
            <h3 id="confirm-dialog-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {title}
            </h3>
            <p id="confirm-dialog-desc" className="mt-1.5 text-sm text-neutral-500 dark:text-neutral-400">
              {description}
            </p>
            {children && <div className="mt-4">{children}</div>}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="btn btn-secondary btn-md"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={cn('btn btn-md font-medium inline-flex items-center gap-1.5', btnVariants[variant])}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{isLoading ? 'Processing...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
