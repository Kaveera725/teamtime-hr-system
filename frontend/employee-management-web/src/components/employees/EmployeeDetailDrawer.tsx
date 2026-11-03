import React from 'react';
import {
  X,
  Mail,
  Phone,
  Building2,
  Calendar,
  Briefcase,
  Shield,
  Edit2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import { useDialogAccessibility } from '@/hooks/useDialogAccessibility';
import type { EmployeeDetailDto, EmployeeListDto } from '@/types/api';

interface EmployeeDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeListDto | null;
  onEdit: (employee: EmployeeListDto | EmployeeDetailDto) => void;
}

export const EmployeeDetailDrawer: React.FC<EmployeeDetailDrawerProps> = ({
  isOpen,
  onClose,
  employee,
  onEdit,
}) => {
  const dialogRef = useDialogAccessibility<HTMLDivElement>({
    isOpen,
    onClose,
  });

  const { data: detail } = useQuery<EmployeeDetailDto>({
    queryKey: ['employeeDetail', employee?.id],
    queryFn: async () => {
      const res = await api.get<EmployeeDetailDto>(`/employees/${employee!.id}`);
      return res.data;
    },
    enabled: isOpen && Boolean(employee?.id),
  });

  if (!isOpen || !employee) return null;

  const data = detail || employee;
  const isActive = (data.status || '').toUpperCase() === 'ACTIVE';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="employee-drawer-title"
          className="w-screen max-w-md bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200"
        >
          {/* Header */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/60 dark:bg-neutral-900/60">
            <h2 id="employee-drawer-title" className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Employee Profile
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Profile Overview Card */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex flex-col items-center text-center p-6 rounded-2xl bg-gradient-to-b from-primary-50/50 to-transparent dark:from-primary-950/20 border border-neutral-200/80 dark:border-neutral-800">
              <Avatar name={data.fullName} size="xl" className="shadow-md" />
              <h3 className="mt-3 text-lg font-bold text-neutral-900 dark:text-neutral-100">
                {data.fullName}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  {data.employeeCode}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${isActive
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                    }`}
                >
                  {isActive ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                  <span>{data.status}</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                {data.position} · {data.departmentName}
              </p>
            </div>

            {/* Information Grid */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Contact & Account Details
              </h4>
              <div className="card divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                <div className="p-3 flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    <span>Email Address</span>
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {data.email}
                  </span>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" />
                    <span>System Role</span>
                  </span>
                  <span className="font-semibold text-primary-600 dark:text-primary-400 uppercase">
                    {(data as any).role || 'EMPLOYEE'}
                  </span>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    <span>Phone Number</span>
                  </span>
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {data.phone || 'Not provided'}
                  </span>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>Department</span>
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {data.departmentName}
                  </span>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-2">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>Job Position</span>
                  </span>
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {data.position}
                  </span>
                </div>

                <div className="p-3 flex items-center justify-between">
                  <span className="text-neutral-500 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Joined Date</span>
                  </span>
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    {formatDate(data.joinedDate)}
                  </span>
                </div>

                {detail?.managedDepartmentName && (
                  <div className="p-3 flex items-center justify-between bg-primary-50/40 dark:bg-primary-950/20">
                    <span className="text-primary-700 dark:text-primary-300 font-medium">
                      Managed Department
                    </span>
                    <span className="font-bold text-primary-700 dark:text-primary-300">
                      {detail.managedDepartmentName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(data);
              }}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>Edit Employee</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

