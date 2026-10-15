import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { FormField } from '@/components/ui/FormField';
import { Briefcase, Lock, Mail, ArrowRight, Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { resolvedTheme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

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
    try {
      await login(data);
      toast.success('Welcome back to TeamTime!');
      navigate(from, { replace: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreFill = (email: string) => {
    setValue('email', email);
    setValue('password', 'Password123!');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 relative selection:bg-primary-500 selection:text-white">
      {/* Theme toggle button in top right */}
      <button
        onClick={toggle}
        className="absolute top-5 right-5 btn btn-ghost btn-icon h-10 w-10 text-neutral-600 dark:text-neutral-400"
        title="Toggle theme"
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="h-5 w-5 text-amber-400" />
        ) : (
          <Moon className="h-5 w-5 text-neutral-700" />
        )}
      </button>

      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-400 items-center justify-center text-white shadow-lg shadow-primary-500/30">
            <Briefcase className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50">
            TeamTime
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Sign in to access your HR & Attendance portal
          </p>
        </div>

        {/* Card */}
        <div className="card p-6 sm:p-8 shadow-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              label="Email Address"
              htmlFor="email"
              required
              error={errors.email?.message}
            >
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  placeholder="name@teamtime.com"
                  autoComplete="email"
                  className={`input pl-9 ${errors.email ? 'input-error' : ''}`}
                  {...register('email')}
                />
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              </div>
            </FormField>

            <FormField
              label="Password"
              htmlFor="password"
              required
              error={errors.password?.message}
            >
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={`input pl-9 ${errors.password ? 'input-error' : ''}`}
                  {...register('password')}
                />
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              </div>
            </FormField>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-lg w-full mt-2 font-medium shadow-md shadow-primary-500/20"
            >
              {isLoading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 block mb-2 text-center">
              Quick Demo Accounts (Click to Fill)
            </span>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handlePreFill('admin@teamtime.com')}
                className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-primary-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-center transition-all"
              >
                <div className="font-semibold text-neutral-900 dark:text-neutral-100">Admin</div>
                <div className="text-[10px] text-neutral-400">admin@</div>
              </button>
              <button
                type="button"
                onClick={() => handlePreFill('manager.eng@teamtime.com')}
                className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-primary-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-center transition-all"
              >
                <div className="font-semibold text-neutral-900 dark:text-neutral-100">Manager</div>
                <div className="text-[10px] text-neutral-400">manager.eng@</div>
              </button>
              <button
                type="button"
                onClick={() => handlePreFill('emp.eng1@teamtime.com')}
                className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:border-primary-500 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-center transition-all"
              >
                <div className="font-semibold text-neutral-900 dark:text-neutral-100">Employee</div>
                <div className="text-[10px] text-neutral-400">emp.eng1@</div>
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-neutral-500 dark:text-neutral-500">
          TeamTime HR & Leave Management System &bull; Secure Enterprise Portal
        </p>
      </div>
    </div>
  );
};
