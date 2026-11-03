import React, { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  MoreVertical,
  Eye,
  Edit2,
  UserX,
  UserCheck,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Users,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmployeeSideSheet } from '@/components/employees/EmployeeSideSheet';
import { EmployeeDetailDrawer } from '@/components/employees/EmployeeDetailDrawer';
import { formatDate, cn } from '@/lib/utils';
import type {
  EmployeeListDto,
  EmployeeDetailDto,
  PagedResult,
  DepartmentDto,
} from '@/types/api';

export const EmployeesPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Sorting
  const [sortBy, setSortBy] = useState<string>('employeecode');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [page, setPage] = useState<number>(1);
  const pageSize = 10;

  // Modals & Drawers state
  const [isSideSheetOpen, setIsSideSheetOpen] = useState(false);
  const [employeeToEdit, setEmployeeToEdit] = useState<EmployeeListDto | EmployeeDetailDto | null>(null);

  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeListDto | null>(null);

  const [employeeToDeactivate, setEmployeeToDeactivate] = useState<EmployeeListDto | null>(null);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);

  // Active action menu row ID
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  // 1. Fetch departments for dropdown
  const { data: departments = [] } = useQuery<DepartmentDto[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get<DepartmentDto[]>('/departments');
      return res.data;
    },
  });

  // 2. Fetch paginated employees list
  const {
    data: pagedData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<PagedResult<EmployeeListDto>>({
    queryKey: [
      'employees',
      searchTerm,
      selectedDepartmentId,
      selectedStatus,
      sortBy,
      sortOrder,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const params: Record<string, any> = {
        page,
        pageSize,
        sortBy,
        sortOrder,
      };
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      if (selectedDepartmentId !== 'ALL') {
        params.departmentId = Number(selectedDepartmentId);
      }
      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }
      const res = await api.get<PagedResult<EmployeeListDto>>('/employees', { params });
      return res.data;
    },
  });

  const employees = pagedData?.items ?? [];
  const totalCount = pagedData?.totalCount ?? 0;
  const totalPages = pagedData?.totalPages ?? 1;

  // Handle Sort toggle
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const renderSortIndicator = (field: string) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-3 w-3 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-primary-600 dark:text-primary-400" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary-600 dark:text-primary-400" />
    );
  };

  // 3. Deactivate Mutation
  const deactivateMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/employees/${id}`);
    },
    onSuccess: () => {
      toast.success(`Employee deactivated successfully.`, {
        description: `${employeeToDeactivate?.fullName} can no longer sign in. Historical records remain preserved.`,
      });
      setIsDeactivateDialogOpen(false);
      setEmployeeToDeactivate(null);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const handleOpenAdd = () => {
    setEmployeeToEdit(null);
    setIsSideSheetOpen(true);
  };

  const handleOpenEdit = (emp: EmployeeListDto | EmployeeDetailDto) => {
    setActiveMenuId(null);
    setEmployeeToEdit(emp);
    setIsSideSheetOpen(true);
  };

  const handleOpenView = (emp: EmployeeListDto) => {
    setActiveMenuId(null);
    setSelectedEmployee(emp);
    setIsDetailDrawerOpen(true);
  };

  const handleOpenDeactivate = (emp: EmployeeListDto) => {
    setActiveMenuId(null);
    setEmployeeToDeactivate(emp);
    setIsDeactivateDialogOpen(true);
  };

  return (
    <div className="space-y-6 page-enter pb-16">
      {/* 1. Header with Primary Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Employee Directory"
          description="Manage company personnel, assign departments, and configure system access."
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh directory"
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
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* 2. Toolbar: Search and Filters */}
      <div className="card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, code, position, email..."
            className="input input-md pl-9 text-xs sm:text-sm w-full"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-neutral-400 hidden sm:inline" />
            <select
              value={selectedDepartmentId}
              onChange={(e) => {
                setSelectedDepartmentId(e.target.value);
                setPage(1);
              }}
              className="input input-sm py-1.5 px-3 text-xs rounded-lg border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
            >
              <option value="ALL">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={String(dept.id)}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-neutral-400 hidden sm:inline" />
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="input input-sm py-1.5 px-3 text-xs rounded-lg border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Main Content: Skeletons, Error, Empty, or Data Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : isError ? (
        <div className="card p-10 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Failed to load employee directory
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
      ) : employees.length === 0 ? (
        <div className="card p-12 text-center">
          <EmptyState
            icon={Users}
            title={searchTerm || selectedDepartmentId !== 'ALL' || selectedStatus !== 'ALL' ? 'No matching employees' : 'No employees added yet'}
            description={
              searchTerm || selectedDepartmentId !== 'ALL' || selectedStatus !== 'ALL'
                ? 'Try adjusting your search keywords or clearing applied filters.'
                : 'Get started by creating your first employee profile.'
            }
            action={{
              label: 'Add Employee',
              onClick: handleOpenAdd,
            }}
            className="border-0 shadow-none bg-transparent"
          />
        </div>
      ) : (
        <div className="card overflow-hidden border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              {/* Table Header with Sortable Columns */}
              <thead className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th
                    scope="col"
                    onClick={() => handleSort('name')}
                    className="py-3 px-4 cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Employee</span>
                      {renderSortIndicator('name')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('employeecode')}
                    className="py-3 px-4 cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Code</span>
                      {renderSortIndicator('employeecode')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('department')}
                    className="py-3 px-4 cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Department</span>
                      {renderSortIndicator('department')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('position')}
                    className="py-3 px-4 cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Position</span>
                      {renderSortIndicator('position')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('joineddate')}
                    className="py-3 px-4 cursor-pointer select-none group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Joined Date</span>
                      {renderSortIndicator('joineddate')}
                    </div>
                  </th>
                  <th
                    scope="col"
                    onClick={() => handleSort('status')}
                    className="py-3 px-4 cursor-pointer select-none group text-center"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Status</span>
                      {renderSortIndicator('status')}
                    </div>
                  </th>
                  <th scope="col" className="py-3 px-4 text-right">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
                {employees.map((emp) => {
                  const isActive = emp.status?.toUpperCase() === 'ACTIVE';

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors group"
                    >
                      {/* Avatar + Full Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={emp.fullName} size="sm" />
                          <div className="min-w-0">
                            <span className="font-semibold text-neutral-900 dark:text-neutral-100 block text-xs sm:text-sm truncate">
                              {emp.fullName}
                            </span>
                            <span className="text-[11px] text-neutral-400 truncate block">
                              {emp.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Code */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                          {emp.employeeCode}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="py-3.5 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                        {emp.departmentName || '—'}
                      </td>

                      {/* Position */}
                      <td className="py-3.5 px-4 text-neutral-600 dark:text-neutral-400">
                        {emp.position}
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4 text-neutral-500 dark:text-neutral-400">
                        {formatDate(emp.joinedDate)}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                          }`}
                        >
                          {isActive ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
                          <span>{emp.status}</span>
                        </span>
                      </td>

                      {/* Row Action Menu */}
                      <td className="py-3.5 px-4 text-right relative">
                        <div className="inline-block text-left">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveMenuId(activeMenuId === emp.id ? null : emp.id)
                            }
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            title="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {/* Dropdown Menu */}
                          {activeMenuId === emp.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={() => setActiveMenuId(null)}
                              />
                              <div className="absolute right-4 mt-1 w-44 rounded-xl card p-1.5 shadow-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-30 animate-in fade-in zoom-in-95 duration-100 text-left">
                                <button
                                  type="button"
                                  onClick={() => handleOpenView(emp)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                >
                                  <Eye className="h-3.5 w-3.5 text-neutral-400" />
                                  <span>View Profile</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(emp)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-neutral-400" />
                                  <span>Edit Employee</span>
                                </button>

                                {isActive && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeactivate(emp)}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                  >
                                    <UserX className="h-3.5 w-3.5" />
                                    <span>Deactivate Account</span>
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-xs text-neutral-500">
              <span>
                Showing page {page} of {totalPages} ({totalCount} total employees)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn btn-secondary btn-sm"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn btn-secondary btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Side Sheet for Create & Edit */}
      <EmployeeSideSheet
        isOpen={isSideSheetOpen}
        onClose={() => {
          setIsSideSheetOpen(false);
          setEmployeeToEdit(null);
        }}
        employeeToEdit={employeeToEdit}
      />

      {/* 5. Detail Inspection Drawer */}
      <EmployeeDetailDrawer
        isOpen={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedEmployee(null);
        }}
        employee={selectedEmployee}
        onEdit={(emp) => handleOpenEdit(emp)}
      />

      {/* 6. Deactivate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeactivateDialogOpen}
        onClose={() => {
          setIsDeactivateDialogOpen(false);
          setEmployeeToDeactivate(null);
        }}
        onConfirm={() => {
          if (employeeToDeactivate) {
            deactivateMutation.mutate(employeeToDeactivate.id);
          }
        }}
        isLoading={deactivateMutation.isPending}
        title={`Deactivate ${employeeToDeactivate?.fullName}?`}
        description={`The user account for ${employeeToDeactivate?.email} will be immediately locked. The employee will no longer be able to log in to TeamTime. Their historical attendance records and leave history will be permanently preserved.`}
        confirmText="Yes, Deactivate"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
export default EmployeesPage;
