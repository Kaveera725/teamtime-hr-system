import React, { useState, useEffect } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MessageSquare,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { formatTime } from '@/lib/utils';
import type { TodayAttendanceStateDto } from '@/types/api';

interface CheckInCardProps {
  todayState?: TodayAttendanceStateDto | null;
  isLoading?: boolean;
}

export const CheckInCard: React.FC<CheckInCardProps> = ({ todayState }) => {
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [note, setNote] = useState<string>('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Keep digital clock live (every second)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute live elapsed worked time if checked in
  useEffect(() => {
    if (todayState?.state === 'CHECKED_IN' && todayState.attendance?.checkIn) {
      const checkInDate = new Date(todayState.attendance.checkIn).getTime();
      const updateElapsed = () => {
        const diffSecs = Math.max(0, Math.floor((Date.now() - checkInDate) / 1000));
        setElapsedSeconds(diffSecs);
      };

      updateElapsed();
      const interval = setInterval(updateElapsed, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedSeconds(0);
    }
  }, [todayState?.state, todayState?.attendance?.checkIn]);

  // Check In Mutation
  const checkInMutation = useMutation({
    mutationFn: async (notesText?: string) => {
      const payload = notesText ? { notes: notesText } : undefined;
      const res = await api.post('/attendance/check-in', payload);
      return res.data;
    },
    onSuccess: (data) => {
      const recordedTime = data?.checkIn ? formatTime(data.checkIn) : formatTime(new Date());
      toast.success(`Checked in successfully at ${recordedTime}`, {
        description: 'Have a productive working day!',
      });
      setNote('');
      setShowNoteInput(false);
      queryClient.invalidateQueries({ queryKey: ['attendanceToday'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceMy'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Check Out Mutation
  const checkOutMutation = useMutation({
    mutationFn: async (notesText?: string) => {
      const payload = notesText ? { notes: notesText } : undefined;
      const res = await api.post('/attendance/check-out', payload);
      return res.data;
    },
    onSuccess: (data) => {
      const recordedTime = data?.checkOut ? formatTime(data.checkOut) : formatTime(new Date());
      const hoursText = data?.workedHours != null ? ` (Worked ${data.workedHours.toFixed(1)} hrs)` : '';
      toast.success(`Checked out successfully at ${recordedTime}${hoursText}`, {
        description: 'Great job today! See you next time.',
      });
      setNote('');
      setShowNoteInput(false);
      queryClient.invalidateQueries({ queryKey: ['attendanceToday'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceMy'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  const isSubmitting = checkInMutation.isPending || checkOutMutation.isPending;

  // Format elapsed time as HH:MM:SS
  const formatLiveElapsed = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedClockTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const isWorkingDay = todayState?.isWorkingDay ?? true;
  const state = todayState?.state ?? 'NOT_CHECKED_IN';
  const checkInTime = todayState?.attendance?.checkIn;
  const checkOutTime = todayState?.attendance?.checkOut;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-white via-neutral-50/50 to-neutral-100/40 dark:from-neutral-900 dark:via-neutral-900/90 dark:to-neutral-950 p-6 sm:p-8 shadow-sm">
      {/* Decorative backdrop glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-primary-500/5 dark:bg-primary-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 -mb-20 w-72 h-72 rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        {/* Left Column: Clock & Date */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 border border-primary-200/60 dark:border-primary-800/50">
              <Sparkles className="h-3.5 w-3.5 text-primary-500" />
              Live Attendance Terminal
            </span>

            {/* Current State Indicator */}
            {state === 'CHECKED_IN' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Clocked In
              </span>
            )}

            {state === 'CHECKED_OUT' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50">
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                Completed Today
              </span>
            )}
          </div>

          <div>
            <div className="text-3xl sm:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 font-mono">
              {formattedClockTime}
            </div>
            <div className="flex items-center gap-2 text-sm sm:text-base font-medium text-neutral-500 dark:text-neutral-400 mt-1">
              <Calendar className="h-4 w-4 text-neutral-400" />
              <span>{formattedDate}</span>
            </div>
          </div>

          {/* Running Timer or Recorded Session Details */}
          {state === 'CHECKED_IN' && checkInTime && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50">
                <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                <span className="text-xs text-amber-700 dark:text-amber-300">Worked Today:</span>
                <span className="font-mono font-bold text-sm text-amber-800 dark:text-amber-200">
                  {formatLiveElapsed(elapsedSeconds)}
                </span>
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                Clocked in at <strong className="text-neutral-700 dark:text-neutral-200">{formatTime(checkInTime)}</strong>
              </span>
            </div>
          )}

          {state === 'CHECKED_OUT' && (
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-neutral-600 dark:text-neutral-300">
              <div className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span>
                  Check-in: <strong>{checkInTime ? formatTime(checkInTime) : '--'}</strong>
                </span>
                <span className="text-neutral-300 dark:text-neutral-600">•</span>
                <span>
                  Check-out: <strong>{checkOutTime ? formatTime(checkOutTime) : '--'}</strong>
                </span>
                {todayState?.attendance?.workedHours != null && (
                  <>
                    <span className="text-neutral-300 dark:text-neutral-600">•</span>
                    <span>
                      Duration: <strong>{todayState.attendance.workedHours.toFixed(1)} hrs</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Non-working Day notification */}
          {!isWorkingDay && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 text-xs text-neutral-600 dark:text-neutral-300 max-w-md">
              <AlertCircle className="h-4 w-4 text-neutral-400 flex-shrink-0" />
              <span>
                Today is a <strong>non-working day</strong> (Weekend or Holiday). Attendance check-in is not required.
              </span>
            </div>
          )}
        </div>

        {/* Right Column: Large Interactive Action Buttons & Optional Note */}
        <div className="flex flex-col sm:items-end gap-3 min-w-[280px]">
          {/* Note Input Toggle / Box */}
          {state !== 'CHECKED_OUT' && isWorkingDay && (
            <div className="w-full">
              {!showNoteInput ? (
                <button
                  type="button"
                  onClick={() => setShowNoteInput(true)}
                  className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 inline-flex items-center gap-1.5 transition-colors self-end"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{note ? 'Edit check-in note' : '+ Add optional note'}</span>
                </button>
              ) : (
                <div className="space-y-1.5 w-full">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                      Note (e.g. WFH, client meeting, late notice)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNoteInput(false)}
                      className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    >
                      Hide
                    </button>
                  </div>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Brief description..."
                    maxLength={150}
                    className="input text-xs py-1.5"
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </div>
          )}

          {/* Main Action Buttons */}
          {state === 'NOT_CHECKED_IN' && (
            <button
              onClick={() => checkInMutation.mutate(note.trim() || undefined)}
              disabled={isSubmitting || !isWorkingDay || !todayState?.canCheckIn}
              className={`w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-base shadow-lg transition-all flex items-center justify-center gap-3 ${
                isWorkingDay && (todayState?.canCheckIn ?? true)
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed shadow-none'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Recording Check-in...</span>
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  <span>{isWorkingDay ? 'Check In Now' : 'Non-Working Day'}</span>
                </>
              )}
            </button>
          )}

          {state === 'CHECKED_IN' && (
            <button
              onClick={() => checkOutMutation.mutate(note.trim() || undefined)}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-base shadow-lg transition-all flex items-center justify-center gap-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-amber-500/20 hover:shadow-amber-500/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Recording Check-out...</span>
                </>
              ) : (
                <>
                  <LogOut className="h-5 w-5" />
                  <span>Check Out Now</span>
                </>
              )}
            </button>
          )}

          {state === 'CHECKED_OUT' && (
            <div className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 font-semibold text-sm flex items-center justify-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
              <span>Attendance Completed For Today</span>
            </div>
          )}

          {/* Subtext info */}
          <div className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center sm:text-right">
            {state === 'NOT_CHECKED_IN' && isWorkingDay && 'Standard office hours start at 9:00 AM'}
            {state === 'CHECKED_IN' && 'Work at least 4 hours to avoid a half-day record'}
            {state === 'CHECKED_OUT' && 'Your attendance record is safely saved'}
            {!isWorkingDay && 'Enjoy your weekend / day off'}
          </div>
        </div>
      </div>
    </div>
  );
};
