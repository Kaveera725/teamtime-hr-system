import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Calendar,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  LeaveTypeDto,
  CreateLeaveTypeRequestDto,
  UpdateLeaveTypeRequestDto,
} from '@/types/api';

interface LeaveTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaveTypeToEdit: LeaveTypeDto | null;
  onSuccess?: () => void;
}

export const LeaveTypeModal: React.FC<LeaveTypeModalProps> = ({
  isOpen,
  onClose,
  leaveTypeToEdit,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const isEditing = Boolean(leaveTypeToEdit);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultDays, setDefaultDays] = useState<number | ''>(14);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (leaveTypeToEdit) {
      setName(leaveTypeToEdit.name || '');
      setDescription(leaveTypeToEdit.description || '');
      setDefaultDays(leaveTypeToEdit.defaultDays ?? 14);
      setIsActive(leaveTypeToEdit.isActive ?? true);
    } else {
      setName('');
      setDescription('');
      setDefaultDays(14);
      setIsActive(true);
    }
    setError('');
  }, [leaveTypeToEdit, isOpen]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateLeaveTypeRequestDto) => {
      const res = await api.post('/leave-types', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Leave type created successfully!', {
        description: `Created leave policy "${data.name}" with ${data.defaultDays} default days.`,
      });
      queryClient.invalidateQueries({ queryKey: ['leaveTypes'] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateLeaveTypeRequestDto) => {
      const res = await api.put(`/leave-types/${leaveTypeToEdit!.id}`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Leave type updated successfully!', {
        description: `Updated leave policy "${data.name}".`,
      });
      queryClient.invalidateQueries({ queryKey: ['leaveTypes'] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Leave type name is required.');
      return;
    }

    const days = defaultDays === '' ? 0 : Number(defaultDays);
    if (days < 0 || days > 365) {
      setError('Default days must be between 0 and 365.');
      return;
    }

    if (isEditing) {
      const payload: UpdateLeaveTypeRequestDto = {
        name: trimmedName,
        description: description.trim() || null,
        defaultDays: days,
        isActive,
      };
      updateMutation.mutate(payload);
    } else {
      const payload: CreateLeaveTypeRequestDto = {
        name: trimmedName,
        description: description.trim() || null,
        defaultDays: days,
        isActive,
      };
      createMutation.mutate(payload);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg card p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {isEditing ? `Edit Leave Type` : 'Add New Leave Type'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {isEditing
                  ? 'Update leave policy rules, default allocation, and active status.'
                  : 'Define a company leave policy and its default yearly allowance.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="my-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Leave Type Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Annual Leave, Casual Leave, Study Leave..."
              disabled={isSubmitting}
              className={cn(
                'input input-md text-xs sm:text-sm w-full',
                error && 'border-rose-500 focus:ring-rose-500/20'
              )}
            />
            {error && <span className="text-[11px] text-rose-500 mt-1 block">{error}</span>}
          </div>

          {/* Default Days */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Default Yearly Allocation (Days) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
              <input
                type="number"
                min="0"
                max="365"
                step="0.5"
                value={defaultDays}
                onChange={(e) => setDefaultDays(e.target.value ? Number(e.target.value) : '')}
                disabled={isSubmitting}
                className="input input-md pl-9 text-xs sm:text-sm w-full font-medium"
              />
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Standard working days credited to employees when annual balances are generated.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Policy Notes / Description <span className="text-neutral-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Paid time off for rest and personal recreation. Requires manager approval."
              disabled={isSubmitting}
              className="input text-xs sm:text-sm w-full py-2.5 resize-none"
            />
          </div>

          {/* Active Status Toggle */}
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                Active for Employee Requests
              </span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block mt-0.5">
                Inactive leave types cannot be chosen on new leave applications.
              </span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isSubmitting}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-neutral-600 peer-checked:bg-primary-600"></div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary btn-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-md font-semibold min-w-32 flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isEditing ? 'Save Changes' : 'Create Leave Type'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

