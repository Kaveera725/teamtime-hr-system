import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Shield,
  Briefcase,
  KeyRound,
  Mail,
  Phone,
  Building2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  EmployeeListDto,
  EmployeeDetailDto,
  DepartmentDto,
  CreateUserRequestDto,
  UpdateEmployeeRequestDto,
} from '@/types/api';

interface EmployeeSideSheetProps {
  isOpen: boolean;
  onClose: () => void;
  employeeToEdit: EmployeeListDto | EmployeeDetailDto | null;
  onSuccess?: () => void;
}

export const EmployeeSideSheet: React.FC<EmployeeSideSheetProps> = ({
  isOpen,
  onClose,
  employeeToEdit,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const isEditing = Boolean(employeeToEdit);

  // 1. Form state - Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'EMPLOYEE' | 'MANAGER' | 'ADMIN'>('EMPLOYEE');

  // 2. Form state - Personal
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');

  // 3. Form state - Job
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [position, setPosition] = useState('');
  const [joinedDate, setJoinedDate] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch departments for dropdown
  const { data: departments = [] } = useQuery<DepartmentDto[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get<DepartmentDto[]>('/departments');
      return res.data;
    },
    enabled: isOpen,
  });

  // Fetch full details if editing to get the role and joinedDate accurately
  const { data: fullDetail } = useQuery<EmployeeDetailDto>({
    queryKey: ['employeeDetail', employeeToEdit?.id],
    queryFn: async () => {
      const res = await api.get<EmployeeDetailDto>(`/employees/${employeeToEdit?.id}`);
      return res.data;
    },
    enabled: isOpen && Boolean(employeeToEdit?.id),
  });

  // Initialize or reset form
  useEffect(() => {
    if (employeeToEdit) {
      const emp = fullDetail || employeeToEdit;
      setEmail(emp.email || '');
      setPassword('');
      const normalizedRole = ((emp as any).role || 'EMPLOYEE').toUpperCase();
      setRole(normalizedRole === 'ADMIN' ? 'ADMIN' : normalizedRole === 'MANAGER' ? 'MANAGER' : 'EMPLOYEE');
      setFirstName(emp.firstName || '');
      setLastName(emp.lastName || '');
      setPhone(emp.phone || '');
      setEmployeeCode(emp.employeeCode || '');
      setDepartmentId(Number(emp.departmentId) || '');
      setPosition(emp.position || '');
      setJoinedDate(emp.joinedDate ? emp.joinedDate.split('T')[0] : '');
      setStatus((emp.status?.toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE');
    } else {
      // Create mode defaults
      setEmail('');
      setPassword('');
      setRole('EMPLOYEE');
      setFirstName('');
      setLastName('');
      setPhone('');
      setEmployeeCode('');
      setDepartmentId(departments.length > 0 ? Number(departments[0].id) : '');
      setPosition('');
      setJoinedDate(new Date().toISOString().split('T')[0]);
      setStatus('ACTIVE');
    }
    setErrors({});
  }, [employeeToEdit, fullDetail, isOpen, departments]);

  // Validation
  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!isEditing) {
      if (!email.trim()) {
        errs.email = 'Email address is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errs.email = 'Please enter a valid email address.';
      }

      if (!password) {
        errs.password = 'Initial password is required.';
      } else if (password.length < 8) {
        errs.password = 'Password must be at least 8 characters.';
      }
    }

    if (!firstName.trim()) {
      errs.firstName = 'First name is required.';
    }

    if (!lastName.trim()) {
      errs.lastName = 'Last name is required.';
    }

    if (!departmentId) {
      errs.departmentId = 'Department assignment is required.';
    }

    if (!position.trim()) {
      errs.position = 'Job position/title is required.';
    }

    if (!joinedDate) {
      errs.joinedDate = 'Joined date is required.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreateUserRequestDto) => {
      const res = await api.post('/users', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Employee created successfully!', {
        description: `Account created for ${data.fullName || data.email} with role ${data.role}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateEmployeeRequestDto) => {
      const res = await api.put(`/employees/${employeeToEdit!.id}`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Employee updated successfully!', {
        description: `Updated profile for ${data.fullName}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employeeDetail', employeeToEdit?.id] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (isEditing) {
      const payload: UpdateEmployeeRequestDto = {
        departmentId: Number(departmentId),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
        position: position.trim(),
        joinedDate: joinedDate || null,
        status,
        role,
      };
      updateMutation.mutate(payload);
    } else {
      const payload: CreateUserRequestDto = {
        email: email.trim().toLowerCase(),
        password,
        role,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        departmentId: Number(departmentId),
        position: position.trim(),
        employeeCode: employeeCode.trim() || undefined,
      };
      createMutation.mutate(payload);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={() => !isSubmitting && onClose()} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/60 dark:bg-neutral-900/60">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary-100 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                  {isEditing ? `Edit Employee: ${employeeToEdit?.fullName}` : 'Add New Employee'}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {isEditing
                    ? 'Update employee profile, department allocation, and access permissions.'
                    : 'Create user account credentials and link employee roster master record.'}
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

          {/* Form Body with 3 Sections */}
          <form
            id="employee-form"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-6 space-y-7"
          >
            {/* SECTION 1: ACCOUNT CREDENTIALS & ROLE */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
                <Shield className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  1. Account & Security
                </h3>
              </div>

              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                      }}
                      disabled={isEditing || isSubmitting}
                      placeholder="e.g. employee@company.com"
                      className={cn(
                        'input input-md pl-9 text-xs sm:text-sm w-full',
                        isEditing && 'bg-neutral-100 dark:bg-neutral-800 cursor-not-allowed opacity-80',
                        errors.email && 'border-rose-500'
                      )}
                    />
                  </div>
                  {errors.email && (
                    <span className="text-[11px] text-rose-500 mt-1 block">{errors.email}</span>
                  )}
                  {isEditing && (
                    <span className="text-[10px] text-neutral-400 mt-1 block">
                      Email address is linked to login identity and cannot be edited directly.
                    </span>
                  )}
                </div>

                {/* Role Selector */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    User Role <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['EMPLOYEE', 'MANAGER', 'ADMIN'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={cn(
                          'p-2.5 rounded-xl border text-xs font-semibold transition-all text-center',
                          role === r
                            ? 'bg-primary-50 dark:bg-primary-950/60 border-primary-500 text-primary-700 dark:text-primary-300 ring-1 ring-primary-500'
                            : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 text-neutral-600 dark:text-neutral-400'
                        )}
                      >
                        {r === 'ADMIN' ? 'Admin' : r === 'MANAGER' ? 'Manager' : 'Employee'}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-neutral-400 mt-1 block">
                    {role === 'ADMIN'
                      ? 'Admins have full master data control, employee directory access, and approvals.'
                      : role === 'MANAGER'
                      ? 'Managers can view their department team, leave calendar, and approve team requests.'
                      : 'Employees can track attendance, submit leaves, and inspect their own balances.'}
                  </span>
                </div>

                {/* Password (Only in create mode) */}
                {!isEditing && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Initial Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                        }}
                        placeholder="Minimum 8 characters"
                        disabled={isSubmitting}
                        className={cn('input input-md pl-9 text-xs sm:text-sm w-full', errors.password && 'border-rose-500')}
                      />
                    </div>
                    {errors.password && (
                      <span className="text-[11px] text-rose-500 mt-1 block">{errors.password}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: PERSONAL INFORMATION */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
                <User className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  2. Personal Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (errors.firstName) setErrors((prev) => ({ ...prev, firstName: '' }));
                    }}
                    placeholder="e.g. Jane"
                    disabled={isSubmitting}
                    className={cn('input input-md text-xs sm:text-sm w-full', errors.firstName && 'border-rose-500')}
                  />
                  {errors.firstName && (
                    <span className="text-[11px] text-rose-500 mt-1 block">{errors.firstName}</span>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (errors.lastName) setErrors((prev) => ({ ...prev, lastName: '' }));
                    }}
                    placeholder="e.g. Doe"
                    disabled={isSubmitting}
                    className={cn('input input-md text-xs sm:text-sm w-full', errors.lastName && 'border-rose-500')}
                  />
                  {errors.lastName && (
                    <span className="text-[11px] text-rose-500 mt-1 block">{errors.lastName}</span>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      disabled={isSubmitting}
                      className="input input-md pl-9 text-xs sm:text-sm w-full"
                    />
                  </div>
                </div>

                {/* Employee Code */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Employee Code {isEditing ? '' : <span className="text-neutral-400 font-normal">(Auto-generated if empty)</span>}
                  </label>
                  <input
                    type="text"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    placeholder="e.g. EMP-0008"
                    disabled={isEditing || isSubmitting}
                    className={cn(
                      'input input-md text-xs sm:text-sm w-full uppercase',
                      isEditing && 'bg-neutral-100 dark:bg-neutral-800 cursor-not-allowed opacity-80'
                    )}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: JOB & EMPLOYMENT */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
                <Briefcase className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                  3. Job & Organization
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400 pointer-events-none" />
                    <select
                      value={departmentId}
                      onChange={(e) => {
                        setDepartmentId(Number(e.target.value));
                        if (errors.departmentId) setErrors((prev) => ({ ...prev, departmentId: '' }));
                      }}
                      disabled={isSubmitting}
                      className={cn('input input-md pl-9 text-xs sm:text-sm w-full font-medium', errors.departmentId && 'border-rose-500')}
                    >
                      <option value="">Select Department...</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.departmentId && (
                    <span className="text-[11px] text-rose-500 mt-1 block">{errors.departmentId}</span>
                  )}
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Job Title / Position <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => {
                      setPosition(e.target.value);
                      if (errors.position) setErrors((prev) => ({ ...prev, position: '' }));
                    }}
                    placeholder="e.g. Senior Software Engineer"
                    disabled={isSubmitting}
                    className={cn('input input-md text-xs sm:text-sm w-full', errors.position && 'border-rose-500')}
                  />
                  {errors.position && (
                    <span className="text-[11px] text-rose-500 mt-1 block">{errors.position}</span>
                  )}
                </div>

                {/* Joined Date */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Joined Date <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <input
                      type="date"
                      value={joinedDate}
                      onChange={(e) => {
                        setJoinedDate(e.target.value);
                        if (errors.joinedDate) setErrors((prev) => ({ ...prev, joinedDate: '' }));
                      }}
                      disabled={isSubmitting}
                      className={cn('input input-md pl-9 text-xs sm:text-sm w-full', errors.joinedDate && 'border-rose-500')}
                    />
                  </div>
                  {errors.joinedDate && (
                    <span className="text-[11px] text-rose-500 mt-1 block">{errors.joinedDate}</span>
                  )}
                </div>

                {/* Status (If editing) */}
                {isEditing && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                      Account Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                      disabled={isSubmitting}
                      className="input input-md text-xs sm:text-sm w-full font-medium"
                    >
                      <option value="ACTIVE">ACTIVE (Can log in)</option>
                      <option value="INACTIVE">INACTIVE (Deactivated)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </form>

          {/* Footer Actions */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-end gap-3">
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
              form="employee-form"
              disabled={isSubmitting}
              className="btn btn-primary btn-md font-semibold min-w-36 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isEditing ? 'Save Changes' : 'Create Employee'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

