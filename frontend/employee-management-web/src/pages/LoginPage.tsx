import React, { useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { FormField } from '@/components/ui/FormField';
import {
  Briefcase,
  Lock,
  Mail,
  ArrowRight,
  Sun,
  Moon,
  Eye,
  EyeOff,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  CalendarCheck,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid work email address'),
  password: z
    .string()
    .min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { resolvedTheme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Check if redirected due to an expired session
  const isSessionExpired = searchParams.get('expired') === 'true';
  const returnUrlParam = searchParams.get('returnUrl');

  // Determine redirection target
  const from =
    returnUrlParam
      ? decodeURIComponent(returnUrlParam)
      : (location.state as any)?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setServerError(null);
    try {
      await login(data);
      toast.success('Welcome back to TeamTime!');
      navigate(from, { replace: true });
    } catch (err) {
      const msg = getErrorMessage(err);
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreFill = (email: string) => {
    setValue('email', email, { shouldValidate: true });
    setValue('password', 'Password123!', { shouldValidate: true });
    setServerError(null);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 relative selection:bg-primary-500 selection:text-white">
      {/* ── Top-Right Theme Toggle ─────────────────────────── */}
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={toggle}
          type="button"
          className="btn btn-secondary btn-icon h-9 w-9 rounded-full shadow-sm text-neutral-600 dark:text-neutral-300"
          title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {resolvedTheme === 'dark' ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-neutral-700" />
          )}
        </button>
      </div>

      {/* ── Left Branded Panel (Desktop Only) ──────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-neutral-900 via-indigo-950 to-neutral-950 p-12 text-white flex-col justify-between overflow-hidden border-r border-neutral-800">
        {/* Subtle decorative background glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top: Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-400 flex items-center justify-center text-white font-bold shadow-lg shadow-primary-500/30">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <span className="text-2xl font-extrabold tracking-tight text-white block">
                TeamTime
              </span>
              <span className="text-[11px] font-semibold text-primary-300 uppercase tracking-widest">
                Workforce Management
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Value Proposition & Feature Highlights */}
        <div className="relative z-10 max-w-lg space-y-8 my-auto">
          <div className="space-y-3">
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight text-white">
              Smarter attendance, seamless leave, and modern HR.
            </h2>
            <p className="text-sm xl:text-base text-neutral-300 leading-relaxed">
              Empower your workforce with automated balance tracking, single-click check-ins, and transparent approval workflows designed for modern teams.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <CalendarCheck className="h-5 w-5 text-indigo-400 mb-2" />
              <div className="font-semibold text-sm text-white">Automated Balances</div>
              <p className="text-xs text-neutral-400 mt-1">
                Zero carry-forward annual cycles and live leave quota deductions.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <Clock className="h-5 w-5 text-emerald-400 mb-2" />
              <div className="font-semibold text-sm text-white">One-Click Attendance</div>
              <p className="text-xs text-neutral-400 mt-1">
                Automatic late check-in detection, worked durations, and half-days.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <ShieldCheck className="h-5 w-5 text-amber-400 mb-2" />
              <div className="font-semibold text-sm text-white">Role-Based Access</div>
              <p className="text-xs text-neutral-400 mt-1">
                Distinct workflows tailored for Employees, Department Managers, and Admins.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <CheckCircle2 className="h-5 w-5 text-sky-400 mb-2" />
              <div className="font-semibold text-sm text-white">Live Audit Trail</div>
              <p className="text-xs text-neutral-400 mt-1">
                Full transparency with recorded approvals, rejections, and comments.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom: Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-neutral-400 border-t border-white/10 pt-6">
          <span>&copy; {new Date().getFullYear()} TeamTime HR System</span>
          <span>Enterprise Portal v1.0</span>
        </div>
      </div>

      {/* ── Right Form Panel (Full width on mobile, 50% on lg) ── */}
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-12 w-full max-w-xl mx-auto">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile Header (Brand Icon + Title) */}
          <div className="text-center space-y-2 lg:text-left">
            <div className="inline-flex lg:hidden h-12 w-12 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-400 items-center justify-center text-white shadow-md shadow-primary-500/20 mb-1">
              <Briefcase className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50">
              Sign in to TeamTime
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Enter your credentials to access your workplace dashboard.
            </p>
          </div>

          {/* ── Expired Session Notice ────────────────────────── */}
          {isSessionExpired && (
            <div
              className="flex items-start gap-3 p-3.5 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs animate-in fade-in duration-200"
              role="alert"
            >
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Your session has expired</span>
                <span className="text-amber-700 dark:text-amber-300">
                  Please log in again to securely resume your work.
                </span>
              </div>
            </div>
          )}

          {/* ── Server Error Banner ───────────────────────────── */}
          {serverError && (
            <div
              className="flex items-start gap-3 p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 text-xs animate-in fade-in duration-200"
              role="alert"
            >
              {/deactivat/i.test(serverError) ? (
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-semibold block">Authentication Failed</span>
                <span className="text-rose-700 dark:text-rose-300">{serverError}</span>
              </div>
            </div>
          )}

          {/* ── Login Form Card ───────────────────────────────── */}
          <div className="card p-6 sm:p-7 shadow-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {/* Email field */}
              <FormField
                label="Email Address"
                htmlFor="login-email"
                required
                error={errors.email?.message}
              >
                <div className="relative">
                  <input
                    id="login-email"
                    type="email"
                    autoFocus
                    autoComplete="email"
                    placeholder="name@teamtime.com"
                    className={`input pl-9 text-sm ${errors.email ? 'input-error' : ''}`}
                    {...register('email')}
                  />
                  <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                </div>
              </FormField>

              {/* Password field with show/hide toggle */}
              <FormField
                label="Password"
                htmlFor="login-password"
                required
                error={errors.password?.message}
              >
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={`input pl-9 pr-10 text-sm ${errors.password ? 'input-error' : ''}`}
                    {...register('password')}
                  />
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </FormField>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary btn-lg w-full mt-2 font-medium shadow-sm transition-all"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 w-full">
                    <span>Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
              </button>
            </form>

            {/* ── Demo Accounts Shortcut ───────────────────────── */}
            <div className="mt-6 pt-5 border-t border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 dark:text-neutral-500">
                  Quick Demo Accounts
                </span>
                <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                  Password123!
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handlePreFill('admin@teamtime.com')}
                  disabled={isLoading}
                  className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-primary-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/80 text-left transition-all group disabled:opacity-50"
                >
                  <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                    Admin
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate">
                    admin@...
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePreFill('manager.eng@teamtime.com')}
                  disabled={isLoading}
                  className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-primary-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/80 text-left transition-all group disabled:opacity-50"
                >
                  <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                    Manager
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate">
                    manager.eng@...
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePreFill('emp.eng1@teamtime.com')}
                  disabled={isLoading}
                  className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-primary-500 hover:bg-neutral-50 dark:hover:bg-neutral-800/80 text-left transition-all group disabled:opacity-50"
                >
                  <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                    Employee
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate">
                    emp.eng1@...
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Security footnote */}
          <div className="text-center text-xs text-neutral-400 dark:text-neutral-500 space-y-1">
            <p>Protected by rate limiting &amp; enterprise BCrypt authentication.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
