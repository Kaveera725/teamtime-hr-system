import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  Building2,
  Users,
  UserCheck,
  Edit2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { DepartmentModal } from '@/components/departments/DepartmentModal';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import type { DepartmentDto } from '@/types/api';

export const DepartmentsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [departmentToEdit, setDepartmentToEdit] = useState<DepartmentDto | null>(null);

  // Fetch departments
  const {
    data: departments = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<DepartmentDto[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get<DepartmentDto[]>('/departments');
      return res.data;
    },
  });

  // Filter departments by search query
  const filteredDepartments = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return departments;
    const q = debouncedSearchTerm.toLowerCase();
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.description || '').toLowerCase().includes(q) ||
        (d.managerName || '').toLowerCase().includes(q)
    );
  }, [departments, debouncedSearchTerm]);

  const handleOpenAdd = () => {
    setDepartmentToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dept: DepartmentDto) => {
    setDepartmentToEdit(dept);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 page-enter pb-16">
      {/* 1. Header with Primary Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Departments"
          description="Organize company departments, monitor headcount, and assign department managers."
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh departments"
            className="btn btn-secondary btn-md p-2.5"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="btn btn-primary btn-md flex items-center gap-2 shadow-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span>Add Department</span>
          </button>
        </div>
      </div>

      {/* 2. Toolbar with Search */}
      <div className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search departments or managers..."
            className="input input-md pl-9 text-xs sm:text-sm w-full"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600"
            >
              Clear
            </button>
          )}
        </div>

        <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 self-end sm:self-auto">
          <Building2 className="h-4 w-4 text-primary-500" />
          <span>
            Total Departments: <strong className="text-neutral-900 dark:text-white">{departments.length}</strong>
          </span>
        </div>
      </div>

      {/* 3. Main Content: Skeleton, Error, Empty, or Card Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div className="card p-10 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Failed to load departments
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {getErrorMessage(error)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn btn-secondary btn-sm"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredDepartments.length === 0 ? (
        <div className="card p-12 text-center">
          <EmptyState
            icon={Building2}
            title={searchTerm ? 'No matching departments' : 'No departments configured'}
            description={
              searchTerm
                ? 'Try adjusting your search terms or clearing the filter.'
                : 'Structure your organization by creating your first department.'
            }
            action={
              <button
                type="button"
                onClick={handleOpenAdd}
                className="btn btn-primary btn-md inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Department</span>
              </button>
            }
            className="border-0 shadow-none bg-transparent"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDepartments.map((dept) => {
            const hasManager = Boolean(dept.managerName);

            return (
              <div
                key={dept.id}
                className="card p-5 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex flex-col justify-between space-y-4 shadow-sm hover:shadow-md group"
              >
                <div>
                  {/* Top Bar: Icon, Name & Edit Button */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate">
                          {dept.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          <Users className="h-3.5 w-3.5 text-neutral-400" />
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                            {dept.employeeCount} {dept.employeeCount === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(dept)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                      title="Edit Department"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Description */}
                  {dept.description && (
                    <p className="mt-3.5 text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2">
                      {dept.description}
                    </p>
                  )}
                </div>

                {/* Manager Allocation Card */}
                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Department Manager
                  </div>

                  {hasManager ? (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/60">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar name={dept.managerName!} size="xs" />
                        <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {dept.managerName}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase shrink-0">
                        <UserCheck className="h-3 w-3" />
                        <span>Active</span>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300">
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span className="font-medium text-[11px]">Unassigned Manager</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(dept)}
                        className="text-[11px] font-bold underline hover:text-amber-900 dark:hover:text-amber-200 shrink-0"
                      >
                        Assign
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Create / Edit Department Modal */}
      <DepartmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setDepartmentToEdit(null);
        }}
        departmentToEdit={departmentToEdit}
      />
    </div>
  );
};
export default DepartmentsPage;
