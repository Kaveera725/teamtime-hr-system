import React, { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LeaveBalanceGrid } from '@/components/leave/LeaveBalanceGrid';
import { LeaveRequestsTable } from '@/components/leave/LeaveRequestsTable';
import { ApplyLeaveSheet } from '@/components/leave/ApplyLeaveSheet';
import {
  LeaveRequestDetailDrawer,
  isCancellationAllowed,
} from '@/components/leave/LeaveRequestDetailDrawer';
import { formatDate, cn } from '@/lib/utils';
import type {
  LeaveBalanceDto,
  LeaveRequestDto,
  LeaveStatus,
  PagedResult,
} from '@/types/api';

export const LeavePage: React.FC = () => {
  const queryClient = useQueryClient();
  const currentCalendarYear = new Date().getFullYear();

  // Year filter for balances & requests
  const [selectedYear, setSelectedYear] = useState<number>(currentCalendarYear);

  // Status filter for requests table
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'ALL'>('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Apply Leave Sheet modal state
  const [isApplySheetOpen, setIsApplySheetOpen] = useState<boolean>(false);

  // Request Detail Drawer state
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestDto | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState<boolean>(false);

  // Cancel Confirmation Dialog state
  const [requestToCancel, setRequestToCancel] = useState<LeaveRequestDto | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState<boolean>(false);

  // 1. Fetch Leave Balances for selected year
  const {
    data: balances = [],
    isLoading: isBalancesLoading,
    refetch: refetchBalances,
    isFetching: isBalancesFetching,
  } = useQuery<LeaveBalanceDto[]>({
    queryKey: ['myLeaveBalances', selectedYear],
    queryFn: async () => {
      const res = await api.get<LeaveBalanceDto[]>('/leave-balances/my', {
        params: { year: selectedYear },
      });
      return res.data;
    },
  });

  // 2. Fetch My Leave Requests with filters & pagination
  const {
    data: pagedRequests,
    isLoading: isRequestsLoading,
    refetch: refetchRequests,
    isFetching: isRequestsFetching,
  } = useQuery<PagedResult<LeaveRequestDto>>({
    queryKey: ['myLeaveRequests', selectedYear, statusFilter, currentPage],
    queryFn: async () => {
      const params: Record<string, any> = {
        year: selectedYear,
        page: currentPage,
        pageSize,
      };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const res = await api.get<PagedResult<LeaveRequestDto>>('/leave-requests/my', {
        params,
      });
      return res.data;
    },
  });

  const requests = pagedRequests?.items ?? [];
  const totalCount = pagedRequests?.totalCount ?? 0;
  const totalPages = pagedRequests?.totalPages ?? 1;

  // 3. Cancel Leave Request Mutation with Optimistic Updates & Rollback
  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.put<LeaveRequestDto>(`/leave-requests/${id}/cancel`);
      return res.data;
    },
    onMutate: async (cancelledId) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['myLeaveRequests'] });
      await queryClient.cancelQueries({ queryKey: ['myLeaveBalances'] });

      // Snapshot caches
      const prevPaged = queryClient.getQueryData<PagedResult<LeaveRequestDto>>([
        'myLeaveRequests',
        selectedYear,
        statusFilter,
        currentPage,
      ]);
      const prevBalances = queryClient.getQueryData<LeaveBalanceDto[]>([
        'myLeaveBalances',
        selectedYear,
      ]);

      // Optimistically update request in table
      if (prevPaged) {
        queryClient.setQueryData<PagedResult<LeaveRequestDto>>(
          ['myLeaveRequests', selectedYear, statusFilter, currentPage],
          {
            ...prevPaged,
            items: prevPaged.items.map((r) =>
              r.id === cancelledId ? { ...r, status: 'CANCELLED' as LeaveStatus } : r
            ),
          }
        );
      }

      // Optimistically update selected drawer if active
      if (selectedRequest && selectedRequest.id === cancelledId) {
        setSelectedRequest((prev) =>
          prev ? { ...prev, status: 'CANCELLED' as LeaveStatus } : null
        );
      }

      // Optimistically restore leave balances
      if (prevBalances && requestToCancel) {
        queryClient.setQueryData<LeaveBalanceDto[]>(
          ['myLeaveBalances', selectedYear],
          (old = []) =>
            old.map((b) => {
              if (Number(b.leaveTypeId) === Number(requestToCancel.leaveTypeId)) {
                if (requestToCancel.status === 'APPROVED') {
                  const newUsed = Math.max(
                    0,
                    (b.usedDays ?? b.used ?? 0) - requestToCancel.totalDays
                  );
                  const rem = (b.allocatedDays ?? b.allocated ?? 0) - newUsed;
                  return {
                    ...b,
                    usedDays: newUsed,
                    used: newUsed,
                    remainingDays: rem,
                    remaining: rem,
                    availableDays: Math.max(0, rem - (b.pendingDays ?? b.pending ?? 0)),
                  };
                } else if (requestToCancel.status === 'PENDING') {
                  const newPending = Math.max(
                    0,
                    (b.pendingDays ?? b.pending ?? 0) - requestToCancel.totalDays
                  );
                  const rem = b.remainingDays ?? b.remaining ?? 0;
                  return {
                    ...b,
                    pendingDays: newPending,
                    pending: newPending,
                    availableDays: Math.max(0, rem - newPending),
                  };
                }
              }
              return b;
            })
        );
      }

      return { prevPaged, prevBalances };
    },
    onError: (err, _variables, context) => {
      // Rollback caches on failure
      if (context?.prevPaged) {
        queryClient.setQueryData(
          ['myLeaveRequests', selectedYear, statusFilter, currentPage],
          context.prevPaged
        );
      }
      if (context?.prevBalances) {
        queryClient.setQueryData(['myLeaveBalances', selectedYear], context.prevBalances);
      }
      toast.error(getErrorMessage(err));
    },
    onSuccess: () => {
      toast.success('Leave request cancelled successfully.', {
        description: 'Allocated working days have been restored to your leave balance.',
      });
      // Invalidate to synchronize
      queryClient.invalidateQueries({ queryKey: ['myLeaveRequests'] });
      queryClient.invalidateQueries({ queryKey: ['myLeaveBalances'] });
      queryClient.invalidateQueries({ queryKey: ['employeeDashboard'] });

      setIsCancelDialogOpen(false);
      setRequestToCancel(null);
    },
  });

  const handleOpenCancelDialog = (request: LeaveRequestDto) => {
    if (!isCancellationAllowed(request)) {
      toast.error('This request cannot be cancelled under company policy.');
      return;
    }
    setRequestToCancel(request);
    setIsCancelDialogOpen(true);
  };

  const handleConfirmCancel = () => {
    if (requestToCancel) {
      cancelMutation.mutate(requestToCancel.id);
    }
  };

  const handleRowClick = (request: LeaveRequestDto) => {
    setSelectedRequest(request);
    setIsDetailDrawerOpen(true);
  };

  return (
    <div className="space-y-6 page-enter pb-12">
      {/* Page Header with Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Leave Management"
          description="Submit leave requests, track approvals, inspect balance limits, and manage your time off."
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              refetchBalances();
              refetchRequests();
            }}
            disabled={isBalancesFetching || isRequestsFetching}
            title="Refresh leave data"
            className="btn btn-secondary btn-md p-2.5"
          >
            <RefreshCw
              className={cn(
                'h-4 w-4',
                (isBalancesFetching || isRequestsFetching) && 'animate-spin'
              )}
            />
          </button>

          <button
            type="button"
            onClick={() => setIsApplySheetOpen(true)}
            className="btn btn-primary btn-md font-semibold flex items-center gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {/* 1. Leave Balance Cards per Leave Type with Progress Rings */}
      <section aria-labelledby="balance-heading">
        <LeaveBalanceGrid
          balances={balances}
          isLoading={isBalancesLoading}
          selectedYear={selectedYear}
        />
      </section>

      {/* 2. My Requests Table with Filters, Pagination, & Row Detail Trigger */}
      <section aria-labelledby="requests-heading">
        <LeaveRequestsTable
          requests={requests}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          isLoading={isRequestsLoading}
          onPageChange={(page) => setCurrentPage(page)}
          statusFilter={statusFilter}
          onStatusFilterChange={(st) => {
            setStatusFilter(st);
            setCurrentPage(1);
          }}
          yearFilter={selectedYear}
          onYearFilterChange={(y) => {
            setSelectedYear(y);
            setCurrentPage(1);
          }}
          onSelectRequest={handleRowClick}
          onCancelRequest={handleOpenCancelDialog}
        />
      </section>

      {/* 3. Apply for Leave Side Sheet */}
      <ApplyLeaveSheet
        isOpen={isApplySheetOpen}
        onClose={() => setIsApplySheetOpen(false)}
        selectedYear={selectedYear}
      />

      {/* 4. Request Detail Drawer with Timeline & Prominent Rejection Banner */}
      <LeaveRequestDetailDrawer
        request={selectedRequest}
        isOpen={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedRequest(null);
        }}
        onCancelClick={(req) => {
          setIsDetailDrawerOpen(false);
          handleOpenCancelDialog(req);
        }}
      />

      {/* 5. Cancellation ConfirmDialog */}
      <ConfirmDialog
        isOpen={isCancelDialogOpen}
        onClose={() => {
          setIsCancelDialogOpen(false);
          setRequestToCancel(null);
        }}
        onConfirm={handleConfirmCancel}
        title="Cancel Leave Request?"
        description={
          requestToCancel
            ? `Are you sure you want to cancel your ${requestToCancel.leaveTypeName} request from ${formatDate(
                requestToCancel.startDate
              )} to ${formatDate(requestToCancel.endDate)} (${requestToCancel.totalDays} day${
                requestToCancel.totalDays === 1 ? '' : 's'
              })? This will restore your allocated days.`
            : 'Are you sure you want to cancel this leave request?'
        }
        confirmText="Yes, Cancel Request"
        cancelText="Keep Request"
        variant="danger"
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
};
