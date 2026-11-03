import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  Sparkles,
  Calendar,
  Clock,
  HeartPulse,
  Baby,
  Briefcase,
  Layers,
  Edit2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { LeaveTypeModal } from '@/components/leave-types/LeaveTypeModal';
import { GenerateBalancesModal } from '@/components/leave-types/GenerateBalancesModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { LeaveTypeDto } from '@/types/api';

// Helper for type-specific visual badge
const getLeaveTypeVisual = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('annual') || lower.includes('vacation')) {
    return {
      icon: Calendar,
      color: 'text-sky-600 dark:text-sky-400',
      bg: 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800',
    };
  }
  if (lower.includes('sick') || lower.includes('medical')) {
    return {
      icon: HeartPulse,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
    };
  }
  if (lower.includes('matern') || lower.includes('patern') || lower.includes('parental')) {
    return {
      icon: Baby,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800',
    };
  }
  if (lower.includes('casual') || lower.includes('personal')) {
    return {
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
    };
  }
  return {
    icon: Briefcase,
    color: 'text-primary-600 dark:text-primary-400',
    bg: 'bg-primary-50 dark:bg-primary-950/40 border-primary-200 dark:border-primary-800',
  };
};

export const LeaveTypesPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [leaveTypeToEdit, setLeaveTypeToEdit] = useState<LeaveTypeDto | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Fetch all leave types (including inactive for admin view)
  const {
    data: leaveTypes = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<LeaveTypeDto[]>({
    queryKey: ['leaveTypes', { includeInactive: true }],
    queryFn: async () => {
      const res = await api.get<LeaveTypeDto[]>('/leave-types?includeInactive=true');
      return res.data;
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ type, nextActive }: { type: LeaveTypeDto; nextActive: boolean }) => {
      setTogglingId(type.id);
      const res = await api.put<LeaveTypeDto>(`/leave-types/${type.id}`, {
        name: type.name,
        description: type.description,
        defaultDays: type.defaultDays,
        isActive: nextActive,
      });
      return res.data;
    },
    onSuccess: (updated) => {
      toast.success(
        updated.isActive
          ? `"${updated.name}" has been activated.`
          : `"${updated.name}" has been deactivated.`
      );
      queryClient.invalidateQueries({ queryKey: ['leaveTypes'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err) || 'Failed to update leave type status.');
    },
    onSettled: () => {
      setTogglingId(null);
    },
  });

  const handleToggle = (type: LeaveTypeDto) => {
    if (toggleActiveMutation.isPending) return;
    toggleActiveMutation.mutate({
      type,
      nextActive: !type.isActive,
    });
  };

  // Filtered leave types
  const filteredLeaveTypes = useMemo(() => {
    return leaveTypes.filter((lt) => {
      if (statusFilter === 'ACTIVE' && !lt.isActive) return false;
      if (statusFilter === 'INACTIVE' && lt.isActive) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = lt.name.toLowerCase().includes(q);
        const matchesDesc = (lt.description || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }
      return true;
    });
  }, [leaveTypes, statusFilter, searchTerm]);

  const activeCount = useMemo(() => leaveTypes.filter((lt) => lt.isActive).length, [leaveTypes]);

  const handleOpenAdd = () => {
    setLeaveTypeToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (lt: LeaveTypeDto) => {
    setLeaveTypeToEdit(lt);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 page-enter pb-16">
        {/* 1. Header with Primary Add Button & Generate Balances Tool */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="Leave Types & Policies"
            description="Configure company leave categories, default allocations, and generate annual employee balances."
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh leave types"
              className="btn btn-secondary btn-md p-2.5"
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
            </button>

            <button
              type="button"
              onClick={() => setIsGenerateModalOpen(true)}
              className="btn btn-secondary btn-md flex items-center gap-2 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/30"
            >
              <Sparkles className="h-4 w-4 text-primary-500" />
              <span>Generate Balances</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="btn btn-primary btn-md flex items-center gap-2 shadow-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span>Add Leave Type</span>
            </button>
          </div>
        </div>

        {/* 2. Toolbar with Search & Filter */}
        <div className="card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search leave types or policies..."
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

            {/* Status Filter Tabs */}
            <div className="inline-flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-all',
                  statusFilter === 'ALL'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                )}
              >
                All ({leaveTypes.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-all',
                  statusFilter === 'ACTIVE'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                )}
              >
                Active ({activeCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('INACTIVE')}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-all',
                  statusFilter === 'INACTIVE'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                )}
              >
                Inactive ({leaveTypes.length - activeCount})
              </button>
            </div>
          </div>

          {/* Counter Info */}
          <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 self-end md:self-auto">
            <Layers className="h-4 w-4 text-primary-500" />
            <span>
              Showing <strong className="text-neutral-800 dark:text-neutral-200">{filteredLeaveTypes.length}</strong> of{' '}
              {leaveTypes.length} types
            </span>
          </div>
        </div>

        {/* 3. Loading Skeletons */}
        {isLoading && (
          <div className="space-y-4">
            <TableSkeleton rows={5} cols={4} />
          </div>
        )}

        {/* 4. Error State with Retry */}
        {isError && !isLoading && (
          <div className="card p-8 border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-rose-950 dark:text-rose-200">
                Failed to load leave types
              </h3>
              <p className="text-sm text-rose-700 dark:text-rose-400 max-w-md mx-auto">
                {getErrorMessage(error) || 'Could not retrieve leave type definitions.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="btn btn-secondary btn-md inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* 5. Empty State */}
        {!isLoading && !isError && filteredLeaveTypes.length === 0 && (
          <EmptyState
            title={searchTerm || statusFilter !== 'ALL' ? 'No matching leave types found' : 'No leave types configured'}
            description={
              searchTerm || statusFilter !== 'ALL'
                ? 'Try adjusting your search terms or filter criteria.'
                : 'Add company leave policies such as Annual Leave, Sick Leave, or Maternity Leave to get started.'
            }
            icon={Calendar}
            action={
              searchTerm || statusFilter !== 'ALL' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('ALL');
                  }}
                  className="btn btn-secondary btn-md"
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="btn btn-primary btn-md inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Leave Type</span>
                </button>
              )
            }
          />
        )}

        {/* 6. Leave Types Table */}
        {!isLoading && !isError && filteredLeaveTypes.length > 0 && (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-700/80 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  <tr>
                    <th scope="col" className="px-6 py-4">
                      Leave Type
                    </th>
                    <th scope="col" className="px-6 py-4">
                      Default Allocation
                    </th>
                    <th scope="col" className="px-6 py-4">
                      Status & Toggle
                    </th>
                    <th scope="col" className="px-6 py-4 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {filteredLeaveTypes.map((type) => {
                    const visual = getLeaveTypeVisual(type.name);
                    const Icon = visual.icon;
                    const isToggling = togglingId === type.id;

                    return (
                      <tr
                        key={type.id}
                        className={cn(
                          'hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors',
                          !type.isActive && 'bg-neutral-50/50 dark:bg-neutral-900/40 opacity-75'
                        )}
                      >
                        {/* Name & Description */}
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3.5">
                            <div
                              className={cn(
                                'w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 mt-0.5',
                                visual.bg
                              )}
                            >
                              <Icon className={cn('h-5 w-5', visual.color)} />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                                  {type.name}
                                </span>
                                {!type.isActive && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                                    Inactive
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 max-w-lg">
                                {type.description || 'No description provided.'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Default Allocation */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                            <Calendar className="h-3.5 w-3.5 text-primary-500" />
                            <span>
                              {type.defaultDays} {type.defaultDays === 1 ? 'day' : 'days'} / yr
                            </span>
                          </div>
                        </td>

                        {/* Active Toggle & Status */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={type.isActive}
                              disabled={isToggling}
                              onClick={() => handleToggle(type)}
                              title={type.isActive ? 'Click to deactivate' : 'Click to activate'}
                              className={cn(
                                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                                type.isActive
                                  ? 'bg-emerald-600 dark:bg-emerald-500'
                                  : 'bg-neutral-300 dark:bg-neutral-700',
                                isToggling && 'opacity-60 cursor-wait'
                              )}
                            >
                              <span className="sr-only">Toggle active status</span>
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center',
                                  type.isActive ? 'translate-x-5' : 'translate-x-0'
                                )}
                              >
                                {isToggling ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-neutral-500" />
                                ) : type.isActive ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-neutral-400" />
                                )}
                              </span>
                            </button>

                            <span
                              className={cn(
                                'text-xs font-medium',
                                type.isActive
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : 'text-neutral-500 dark:text-neutral-400'
                              )}
                            >
                              {type.isActive ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(type)}
                            className="btn btn-secondary btn-sm inline-flex items-center gap-1.5"
                            title={`Edit ${type.name}`}
                          >
                            <Edit2 className="h-3.5 w-3.5 text-neutral-500" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. Create / Edit Leave Type Modal */}
        <LeaveTypeModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          leaveTypeToEdit={leaveTypeToEdit}
        />

          {/* 8. Admin Tool: Generate Balances Modal */}
      <GenerateBalancesModal
          isOpen={isGenerateModalOpen}
          onClose={() => setIsGenerateModalOpen(false)}
        />
      </div>
      );
};
