import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  User,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  DepartmentDto,
  CreateDepartmentRequestDto,
  UpdateDepartmentRequestDto,
  EmployeeListDto,
  PagedResult,
} from '@/types/api';

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentToEdit: DepartmentDto | null;
  onSuccess?: () => void;
}

export const DepartmentModal: React.FC<DepartmentModalProps> = ({
  isOpen,
  onClose,
  departmentToEdit,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const isEditing = Boolean(departmentToEdit);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState<number | ''>('');
  const [error, setError] = useState('');

  // Fetch employees for manager dropdown
  const { data: employeesData } = useQuery<PagedResult<EmployeeListDto>>({
    queryKey: ['employeesForManagerSelection'],
    queryFn: async () => {
      const res = await api.get<PagedResult<EmployeeListDto>>('/employees', {
        params: { pageSize: 200, status: 'ACTIVE' },
      });
      return res.data;
    },
    enabled: isOpen,
  });

  const employees = employeesData?.items ?? [];

  useEffect(() => {
    if (departmentToEdit) {
      setName(departmentToEdit.name || '');
      setDescription(departmentToEdit.description || '');
      setManagerId(Number(departmentToEdit.managerId) || '');
    } else {
      setName('');
      setDescription('');
      setManagerId('');
    }
    setError('');
  }, [departmentToEdit, isOpen]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateDepartmentRequestDto) => {
      const res = await api.post('/departments', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Department created successfully!', {
        description: `Created department "${data.name}".`,
      });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateDepartmentRequestDto) => {
      const res = await api.put(`/departments/${departmentToEdit!.id}`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Department updated successfully!', {
        description: `Updated "${data.name}".`,
      });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
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
      setError('Department name is required.');
      return;
    }

    if (isEditing) {
      const payload: UpdateDepartmentRequestDto = {
        name: trimmedName,
        description: description.trim() || null,
        managerId: managerId ? Number(managerId) : null,
      };
      updateMutation.mutate(payload);
    } else {
      const payload: CreateDepartmentRequestDto = {
        name: trimmedName,
        description: description.trim() || null,
        managerId: managerId ? Number(managerId) : null,
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
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {isEditing ? `Edit Department` : 'Add New Department'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {isEditing
                  ? `Update department details or reassign the department manager.`
                  : 'Define a new company department and optionally assign a department manager.'}
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
          {/* Department Name */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Department Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Engineering, Marketing, Operations..."
              disabled={isSubmitting}
              className={cn(
                'input input-md text-xs sm:text-sm w-full',
                error && 'border-rose-500 focus:ring-rose-500/20'
              )}
            />
            {error && <span className="text-[11px] text-rose-500 mt-1 block">{error}</span>}
          </div>

          {/* Manager Assignment */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Department Manager <span className="text-neutral-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
              <select
                value={managerId}
                onChange={(e) => setManagerId(e.target.value ? Number(e.target.value) : '')}
                disabled={isSubmitting}
                className="input input-md pl-9 text-xs sm:text-sm w-full font-medium"
              >
                <option value="">No manager assigned</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.position} · {emp.employeeCode})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">
              Managers can approve team leave requests and inspect team attendance.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Description <span className="text-neutral-400 font-normal">(Optional)</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview of the department's mandate and scope..."
              disabled={isSubmitting}
              className="input text-xs sm:text-sm w-full py-2.5 resize-none"
            />
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
                  <span>{isEditing ? 'Save Changes' : 'Create Department'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

