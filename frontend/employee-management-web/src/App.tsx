import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';

import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AttendancePage } from '@/pages/AttendancePage';
import { LeavePage } from '@/pages/LeavePage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { DepartmentsPage } from '@/pages/DepartmentsPage';
import { LeaveTypesPage } from '@/pages/LeaveTypesPage';
import { DesignPage } from '@/pages/DesignPage';
import { UnauthorizedPage } from '@/pages/UnauthorizedPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
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
            <Routes>
              {/* Public route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Design showcase (accessible directly for verification) */}
              <Route element={<AppShell />}>
                <Route path="/design" element={<DesignPage />} />
              </Route>

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/leave" element={<LeavePage />} />

                  {/* Manager & Admin */}
                  <Route element={<ProtectedRoute allowedRoles={['Manager', 'Admin']} />}>
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
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
