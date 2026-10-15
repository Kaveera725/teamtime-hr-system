import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import type { LoginRequest, LoginResponse, Role } from '@/types/api';

// ── Shape ─────────────────────────────────────────────────
export interface AuthUser {
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  departmentId: string | null;
  token: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (req: LoginRequest) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isManager: boolean;
}

// ── Context ───────────────────────────────────────────────
export const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_TOKEN = 'tt_token';
const STORAGE_USER  = 'tt_user';

function getInitialUser(): AuthUser | null {
  try {
    const token = localStorage.getItem(STORAGE_TOKEN);
    const raw   = localStorage.getItem(STORAGE_USER);
    if (token && raw) {
      const u = JSON.parse(raw) as AuthUser;
      return { ...u, token };
    }
  } catch {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
  }
  return null;
}

function normalizeRole(role: string): Role {
  const upper = (role || '').toUpperCase();
  if (upper === 'ADMIN') return 'Admin';
  if (upper === 'MANAGER') return 'Manager';
  return 'Employee';
}

// ── Provider ──────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getInitialUser);
  const isLoading = false;

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    setUser(null);
  }, []);

  // Listen for 401 event from api interceptor
  useEffect(() => {
    const handle = () => logout();
    window.addEventListener('auth:logout', handle);
    return () => window.removeEventListener('auth:logout', handle);
  }, [logout]);

  const login = useCallback(async (req: LoginRequest) => {
    const { data } = await api.post<LoginResponse>('/auth/login', req);
    const employeeId = data.user?.employeeId
      ? String(data.user.employeeId)
      : data.employeeId
      ? String(data.employeeId)
      : String(data.user?.id ?? '');
    const name = data.user?.fullName || data.name || data.user?.email || req.email.split('@')[0];
    const email = data.user?.email || data.email || req.email;
    const role = normalizeRole(data.user?.role || (data.role as string) || 'Employee');
    const departmentId = data.departmentId ?? null;

    const u: AuthUser = {
      employeeId,
      name,
      email,
      role,
      departmentId,
      token: data.token,
    };
    localStorage.setItem(STORAGE_TOKEN, data.token);
    localStorage.setItem(STORAGE_USER, JSON.stringify(u));
    setUser(u);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    login,
    logout,
    isAdmin:   user?.role === 'Admin',
    isManager: user?.role === 'Manager' || user?.role === 'Admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
