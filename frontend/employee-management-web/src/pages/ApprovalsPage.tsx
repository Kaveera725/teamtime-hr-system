import React, { useState, useMemo } from 'react';
import {
  Inbox,
  CalendarDays,
  Search,
  RefreshCw,
  LayoutGrid,
  List,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ApprovalCard } from '@/components/leave/ApprovalCard';
import { RejectLeaveModal } from '@/components/leave/RejectLeaveModal';
import { TeamLeaveCalendar } from '@/components/leave/TeamLeaveCalendar';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';
import type {
  LeaveRequestDto,
  PagedResult,
  DepartmentDto,
  LeaveTypeDto,
} from '@/types/api';

type ApprovalTab = 'PENDING' | 'APPROVED' | 'REJECTED';

export const ApprovalsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  // Primary top-level view: 'inbox' or 'calendar'
  const [activeView, setActiveView] = useState<'inbox' | 'calendar'>('inbox');

  // Status Tab for Inbox: PENDING | APPROVED | REJECTED
  const [statusTab, setStatusTab] = useState<ApprovalTab>('PENDING');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<string>('ALL');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'rows'>('cards');

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 12;

  // Reject modal state
  const [requestToReject, setRequestToReject] = useState<LeaveRequestDto | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Approving item tracking
  const [approvingId, setApprovingId] = useState<number | null>(null);

  // 1. Fetch departments (for Admin filter)
  const { data: departments = [] } = useQuery<DepartmentDto[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get<DepartmentDto[]>('/departments');
      return res.data;
    },
    enabled: isAdmin,
  });

  // 2. Fetch leave types for filter
  const { data: leaveTypes = [] } = useQuery<LeaveTypeDto[]>({
    queryKey: ['leaveTypes'],
    queryFn: async () => {
      const res = await api.get<LeaveTypeDto[]>('/leave-types');
      return res.data;
    },
  });

  // 3. Fetch requests for active tab with pagination & filters
  const {
    data: pagedData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch: refetchRequests,
  } = useQuery<PagedResult<LeaveRequestDto>>({
    queryKey: [
      'leaveApprovals',
      statusTab,
      selectedDepartmentId,
      selectedLeaveTypeId,
      currentPage,
    ],
    queryFn: async () => {
      const params: Record<string, any> = {
        status: statusTab,
        page: currentPage,
        pageSize,
      };
      if (selectedDepartmentId !== 'ALL') {
        params.departmentId = selectedDepartmentId;
      }
      const res = await api.get<PagedResult<LeaveRequestDto>>('/leave-requests', { params });
      return res.data;
    },
  });

  // 4. Fetch counts for all three tabs (Pending, Approved, Rejected)
  const { data: pendingCountData } = useQuery<PagedResult<LeaveRequestDto>>({
    queryKey: ['leaveApprovalsCount', 'PENDING', selectedDepartmentId],
    queryFn: async () => {
      const params: Record<string, any> = { status: 'PENDING', page: 1, pageSize: 1 };
      if (selectedDepartmentId !== 'ALL') params.departmentId = selectedDepartmentId;
      const res = await api.get<PagedResult<LeaveRequestDto>>('/leave-requests', { params });
      return res.data;
    },
  });

  const { data: approvedCountData } = useQuery<PagedResult<LeaveRequestDto>>({
    queryKey: ['leaveApprovalsCount', 'APPROVED', selectedDepartmentId],
    queryFn: async () => {
      const params: Record<string, any> = { status: 'APPROVED', page: 1, pageSize: 1 };
      if (selectedDepartmentId !== 'ALL') params.departmentId = selectedDepartmentId;
      const res = await api.get<PagedResult<LeaveRequestDto>>('/leave-requests', { params });
      return res.data;
    },
  });

  const { data: rejectedCountData } = useQuery<PagedResult<LeaveRequestDto>>({
    queryKey: ['leaveApprovalsCount', 'REJECTED', selectedDepartmentId],
    queryFn: async () => {
      const params: Record<string, any> = { status: 'REJECTED', page: 1, pageSize: 1 };
      if (selectedDepartmentId !== 'ALL') params.departmentId = selectedDepartmentId;
      const res = await api.get<PagedResult<LeaveRequestDto>>('/leave-requests', { params });
      return res.data;
    },
  });

  const pendingCount = pendingCountData?.totalCount ?? 0;
  const approvedCount = approvedCountData?.totalCount ?? 0;
  const rejectedCount = rejectedCountData?.totalCount ?? 0;

  // 5. Fetch all active team leaves for calculating "who else is away" overlap
  const { data: allActiveLeavesData } = useQuery<PagedResult<LeaveRequestDto>>({
    queryKey: ['allActiveTeamLeaves', selectedDepartmentId],
    queryFn: async () => {
      const params: Record<string, any> = {
        pageSize: 500,
      };
      if (selectedDepartmentId !== 'ALL') {
        params.departmentId = selectedDepartmentId;
      }
      const res = await api.get<PagedResult<LeaveRequestDto>>('/leave-requests', { params });
      return res.data;
    },
  });

  const allTeamLeaves = allActiveLeavesData?.items ?? [];

  // Filter requests by search query and leave type client-side if needed
  const rawItems = pagedData?.items ?? [];
  const filteredItems = useMemo(() => {
    return rawItems.filter((req) => {
      // Leave type filter
      if (selectedLeaveTypeId !== 'ALL' && String(req.leaveTypeId) !== selectedLeaveTypeId) {
        return false;
      }
      // Search query filter
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase();
        const matchesName = req.employeeName.toLowerCase().includes(q);
        const matchesCode = (req.employeeCode || '').toLowerCase().includes(q);
        const matchesType = req.leaveTypeName.toLowerCase().includes(q);
        const matchesReason = (req.reason || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesType && !matchesReason) return false;
      }
      return true;
    });
  }, [rawItems, selectedLeaveTypeId, debouncedSearchQuery]);

  // Total pages
  const totalPages = pagedData?.totalPages ?? 1;

  // Helper to refresh all approval queries
  const refreshAllQueries = () => {
    refetchRequests();
    queryClient.invalidateQueries({ queryKey: ['leaveApprovals'] });
    queryClient.invalidateQueries({ queryKey: ['leaveApprovalsCount'] });
    queryClient.invalidateQueries({ queryKey: ['allActiveTeamLeaves'] });
    queryClient.invalidateQueries({ queryKey: ['teamLeaveCalendar'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  // 6. Approve Mutation (1-click with toast + 409 conflict handling)
  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.put<LeaveRequestDto>(`/leave-requests/${id}/approve`);
      return res.data;
    },
    onMutate: (id) => {
      setApprovingId(id);
    },
    onSettled: () => {
      setApprovingId(null);
    },
    onSuccess: (data) => {
      toast.success(`Leave request approved successfully!`, {
        description: `Approved ${data.employeeName}'s ${data.leaveTypeName} (${data.totalDays}d).`,
      });
      refreshAllQueries();
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.response?.data?.title || '';

      if (status === 409 || detail.includes('Only PENDING requests') || detail.includes('already been decided') || detail.includes('concurrency')) {
        toast.error('Leave Request Already Decided', {
          description: 'This leave request has already been decided or updated by another user. The approvals list has been refreshed.',
        });
        refreshAllQueries();
      } else {
        toast.error(getErrorMessage(err));
      }
    },
  });

  // 7. Reject Mutation (opens dialog requiring reason + 409 conflict handling)
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await api.put<LeaveRequestDto>(`/leave-requests/${id}/reject`, {
        rejectionReason: reason,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Leave request rejected.`, {
        description: `Feedback has been sent to ${data.employeeName}.`,
      });
      setIsRejectModalOpen(false);
      setRequestToReject(null);
      refreshAllQueries();
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.response?.data?.title || '';

      if (status === 409 || detail.includes('Only PENDING requests') || detail.includes('already been decided') || detail.includes('concurrency')) {
        toast.error('Leave Request Already Decided', {
          description: 'This request was already decided by another manager or administrator. The list has been refreshed.',
        });
        setIsRejectModalOpen(false);
        setRequestToReject(null);
        refreshAllQueries();
      } else {
        toast.error(getErrorMessage(err));
      }
    },
  });

  const handleApprove = (req: LeaveRequestDto) => {
    approveMutation.mutate(req.id);
  };

  const handleOpenReject = (req: LeaveRequestDto) => {
    setRequestToReject(req);
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = (reason: string) => {
    if (requestToReject) {
      rejectMutation.mutate({ id: requestToReject.id, reason });
    }
  };

  return (
    <div className="space-y-6 page-enter pb-16">
      {/* Top Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <PageHeader
          title="Approvals & Team Calendar"
          description="Review team leave requests with real-time coverage context, check the team calendar, and manage decisions."
        />

        {/* View Switcher & Global Refresh */}
        <div className="flex items-center gap-3">
          {/* Primary View Switcher: Inbox vs Calendar */}
          <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => setActiveView('inbox')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                activeView === 'inbox'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              <Inbox className="h-4 w-4" />
              <span>Inbox</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveView('calendar')}
              className={cn(
                'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
                activeView === 'calendar'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              )}
            >
              <CalendarDays className="h-4 w-4" />
              <span>Team Calendar</span>
            </button>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={refreshAllQueries}
            disabled={isFetching}
            title="Refresh requests"
            className="btn btn-secondary btn-md p-2.5"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* VIEW 1: APPROVALS INBOX */}
      {activeView === 'inbox' && (
        <div className="space-y-5">
          {/* Status Tabs Bar */}
          <div className="card p-2 sm:p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setStatusTab('PENDING');
                  setCurrentPage(1);
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0',
                  statusTab === 'PENDING'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                )}
              >
                <Clock className="h-4 w-4" />
                <span>Pending</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white">
                  {pendingCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusTab('APPROVED');
                  setCurrentPage(1);
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0',
                  statusTab === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Approved</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white">
                  {approvedCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusTab('REJECTED');
                  setCurrentPage(1);
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all shrink-0',
                  statusTab === 'REJECTED'
                    ? 'bg-rose-100 text-rose-900 dark:bg-rose-950/80 dark:text-rose-200'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                )}
              >
                <XCircle className="h-4 w-4" />
                <span>Rejected</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white">
                  {rejectedCount}
                </span>
              </button>
            </div>

            {/* View Mode Toggle: Cards vs Rows */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              <span className="text-xs text-neutral-400 hidden sm:inline">View:</span>
              <div className="flex items-center p-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-2xs'
                      : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                  )}
                  title="Card Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('rows')}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    viewMode === 'rows'
                      ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-2xs'
                      : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
                  )}
                  title="Row List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Search & Filters Row */}
          <div className="card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by employee name, code, reason..."
                className="input input-md pl-9 text-xs sm:text-sm w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Leave Type Filter */}
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedLeaveTypeId}
                  onChange={(e) => setSelectedLeaveTypeId(e.target.value)}
                  className="input input-sm py-1.5 px-3 text-xs rounded-lg border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                >
                  <option value="ALL">All Leave Types</option>
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Department Filter (Admin only) */}
              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedDepartmentId}
                    onChange={(e) => {
                      setSelectedDepartmentId(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="input input-sm py-1.5 px-3 text-xs rounded-lg border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  >
                    <option value="ALL">All Departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Request Cards / Rows Content */}
          {isError && !isLoading ? (
            <div className="card p-8 border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-rose-950 dark:text-rose-200">
                  Failed to load approval requests
                </h3>
                <p className="text-sm text-rose-700 dark:text-rose-400 max-w-md mx-auto">
                  {getErrorMessage(error)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => refetchRequests()}
                className="btn btn-secondary btn-md inline-flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Try Again</span>
              </button>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="card p-5 animate-pulse space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded w-1/2" />
                      <div className="h-2.5 bg-neutral-200 dark:bg-neutral-800 rounded w-1/3" />
                    </div>
                  </div>
                  <div className="h-16 bg-neutral-100 dark:bg-neutral-800 rounded-xl" />
                  <div className="h-8 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="card p-12 text-center">
              <EmptyState
                icon={statusTab === 'PENDING' ? Clock : statusTab === 'APPROVED' ? CheckCircle2 : XCircle}
                title={
                  statusTab === 'PENDING'
                    ? 'All Caught Up!'
                    : statusTab === 'APPROVED'
                    ? 'No Approved Leave'
                    : 'No Rejected Leave'
                }
                description={
                  statusTab === 'PENDING'
                    ? 'There are no pending leave requests awaiting approval at this time.'
                    : `No ${statusTab.toLowerCase()} requests match your current filters.`
                }
                className="border-0 shadow-none bg-transparent"
              />
            </div>
          ) : (
            <div
              className={cn(
                viewMode === 'cards'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5'
                  : 'space-y-3'
              )}
            >
              {filteredItems.map((req) => (
                <ApprovalCard
                  key={req.id}
                  request={req}
                  allTeamLeaves={allTeamLeaves}
                  viewMode={viewMode}
                  isApproving={approvingId === req.id}
                  onApprove={handleApprove}
                  onReject={handleOpenReject}
                  onViewCalendar={() => setActiveView('calendar')}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500">
              <span>
                Page {currentPage} of {totalPages} ({pagedData?.totalCount ?? 0} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="btn btn-secondary btn-sm"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="btn btn-secondary btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: TEAM LEAVE CALENDAR */}
      {activeView === 'calendar' && (
        <div className="space-y-4">
          <TeamLeaveCalendar
            onApproveRequest={handleApprove}
            onRejectRequest={handleOpenReject}
          />
        </div>
      )}

      {/* Rejection Dialog with Mandatory Reason */}
      <RejectLeaveModal
        isOpen={isRejectModalOpen}
        request={requestToReject}
        isLoading={rejectMutation.isPending}
        onClose={() => {
          setIsRejectModalOpen(false);
          setRequestToReject(null);
        }}
        onConfirm={handleConfirmReject}
      />
    </div>
  );
};
export default ApprovalsPage;
