import React, { useState } from 'react';
import {
  Menu,
  Sun,
  Moon,
  LogOut,
  LogIn,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar } from '@/components/ui/Avatar';
import { api, getErrorMessage } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDuration } from '@/lib/utils';
import type { AttendanceTodayState } from '@/types/api';

interface TopBarProps {
  onOpenMobileMenu: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenMobileMenu }) => {
  const { user, logout } = useAuth();
  const { resolvedTheme, toggle } = useTheme();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch today's attendance state
  const { data: todayState } = useQuery<AttendanceTodayState>({
    queryKey: ['attendanceToday'],
    queryFn: async () => {
      const res = await api.get<AttendanceTodayState>('/attendance/my/today');
      return res.data;
    },
    enabled: !!user,
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);
      return api.post('/attendance/check-in');
    },
    onSuccess: () => {
      toast.success('Checked in successfully!');
      queryClient.invalidateQueries({ queryKey: ['attendanceToday'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
    onSettled: () => setIsSubmitting(false),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      setIsSubmitting(true);
      return api.post('/attendance/check-out');
    },
    onSuccess: () => {
      toast.success('Checked out successfully!');
      queryClient.invalidateQueries({ queryKey: ['attendanceToday'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
    onSettled: () => setIsSubmitting(false),
  });

  const renderAttendanceButton = () => {
    if (!todayState) return null;

    if (todayState.state === 'NOT_CHECKED_IN') {
      return (
        <button
          onClick={() => checkInMutation.mutate()}
          disabled={isSubmitting}
          className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all"
          title="Record check-in for today"
        >
          <LogIn className="h-3.5 w-3.5 mr-1" />
          <span>Check In</span>
        </button>
      );
    }

    if (todayState.state === 'CHECKED_IN') {
      return (
        <button
          onClick={() => checkOutMutation.mutate()}
          disabled={isSubmitting}
          className="btn btn-sm bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm transition-all"
          title={`Checked in at ${todayState.checkInTime ? new Date(todayState.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`}
        >
          <Clock className="h-3.5 w-3.5 mr-1" />
          <span>Check Out</span>
        </button>
      );
    }

    if (todayState.state === 'CHECKED_OUT') {
      return (
        <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          <span>
            Done ({todayState.workedMinutes ? formatDuration(todayState.workedMinutes) : 'Completed'})
          </span>
        </div>
      );
    }

    return null;
  };

  const roleBadgeColor: Record<string, string> = {
    Admin: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    ADMIN: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    Manager: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    MANAGER: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    Employee: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    EMPLOYEE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  };

  return (
    <header className="h-16 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="Open mobile navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        {/* Attendance Action Button */}
        {renderAttendanceButton()}

        {/* Dark/Light mode toggle */}
        <button
          onClick={toggle}
          className="btn btn-ghost btn-icon h-9 w-9 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-neutral-700" />
          )}
        </button>

        <div className="h-5 w-[1px] bg-neutral-200 dark:bg-neutral-800" />

        {/* User profile & Logout */}
        {user ? (
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size="sm" />
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                {user.name}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                    roleBadgeColor[user.role] || roleBadgeColor.Employee
                  }`}
                >
                  {user.role}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="btn btn-ghost btn-icon h-9 w-9 text-neutral-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
};
