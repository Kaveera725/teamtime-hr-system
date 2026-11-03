import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2 } from 'lucide-react';

// Route-level Code Splitting for optimal initial page-load performance
const LoginPage = React.lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = React.lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const AttendancePage = React.lazy(() => import('@/pages/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const LeavePage = React.lazy(() => import('@/pages/LeavePage').then((m) => ({ default: m.LeavePage })));
const ApprovalsPage = React.lazy(() => import('@/pages/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })));
const EmployeesPage = React.lazy(() => import('@/pages/EmployeesPage').then((m) => ({ default: m.EmployeesPage })));
const DepartmentsPage = React.lazy(() => import('@/pages/DepartmentsPage').then((m) => ({ default: m.DepartmentsPage })));
const LeaveTypesPage = React.lazy(() => import('@/pages/LeaveTypesPage').then((m) => ({ default: m.LeaveTypesPage })));
const ProfilePage = React.lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const UnauthorizedPage = React.lazy(() => import('@/pages/UnauthorizedPage').then((m) => ({ default: m.UnauthorizedPage })));
const DesignPage = import.meta.env.DEV
  ? React.lazy(() => import('@/pages/DesignPage').then((m) => ({ default: m.DesignPage })))
  : null;

// Accessible, subtle page loading skeleton
const PageLoadingFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-12 min-h-[50vh] space-y-4" role="status" aria-live="polite">
    <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Loading view...</span>
  </div>
);

// Sensible Query Caching: 2 minutes stale time, 10 minutes garbage collection
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,
      gcTime: 1000 * 60 * 10,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Toaster position="top-right" richColors closeButton />
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                {/* Public route */}
                <Route path="/login" element={<LoginPage />} />

                {/* Dev-only Design Showcase */}
                {import.meta.env.DEV && DesignPage && (
                  <Route element={<AppShell />}>
                    <Route path="/design" element={<DesignPage />} />
                  </Route>
                )}

                {/* Protected routes */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/attendance" element={<AttendancePage />} />
                    <Route path="/leave" element={<LeavePage />} />
                    <Route path="/profile" element={<ProfilePage />} />

                    {/* Manager & Admin */}
                    <Route element={<ProtectedRoute allowedRoles={['Manager', 'Admin']} />}>
                      <Route path="/approvals" element={<ApprovalsPage />} />
                      <Route path="/employees" element={<EmployeesPage />} />
                    </Route>

                    {/* Admin Only */}
                    <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
                      <Route path="/departments" element={<DepartmentsPage />} />
                      <Route path="/leave-types" element={<LeaveTypesPage />} />
                    </Route>

                    <Route path="/unauthorized" element={<UnauthorizedPage />} />
                  </Route>
                </Route>

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
