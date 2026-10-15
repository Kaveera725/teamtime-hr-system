import axios, { type AxiosError } from 'axios';
import type { ApiError } from '@/types/api';

// ── Axios instance ────────────────────────────────────────
export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Token injection ───────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── 401 handling + expired session redirect ──────────────
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('tt_token');
      localStorage.removeItem('tt_user');

      // Dispatch global logout event
      window.dispatchEvent(new CustomEvent('auth:logout'));

      // If user was on a protected page and session expired, redirect to /login?expired=true
      if (!window.location.pathname.startsWith('/login')) {
        const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?expired=true&returnUrl=${returnUrl}`;
      }
    }
    return Promise.reject(error);
  },
);

// ── Helper to extract a human-readable error message ──────
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = (error as AxiosError<ApiError>).response?.data;

    // Rate limiting (Section 9 / BR)
    if (status === 429) {
      return 'Too many failed login attempts. Please wait a few moments before trying again.';
    }

    // 401 Unauthorized
    if (status === 401) {
      const detail = data?.detail || data?.title || '';
      if (/deactivat/i.test(detail)) {
        return 'Your account has been deactivated. Please contact your administrator.';
      }
      return 'Invalid email or password. Please check your credentials and try again.';
    }

    // 403 Forbidden
    if (status === 403) {
      return data?.detail || 'You do not have permission to perform this action.';
    }

    // 409 Conflict
    if (status === 409) {
      return data?.detail || 'A conflict occurred with the current state of the resource.';
    }

    // 500+ Server Error
    if (status && status >= 500) {
      return 'An internal server error occurred. Please try again later.';
    }

    // Backend validation ProblemDetails errors dictionary
    if (data?.errors) {
      const firstKey = Object.keys(data.errors)[0];
      if (firstKey && data.errors[firstKey]?.length > 0) {
        return data.errors[firstKey][0];
      }
    }

    if (data?.detail) return data.detail;
    if (data?.title) return data.title;

    // Network / timeout error
    if (error.code === 'ECONNABORTED') {
      return 'The request timed out. Please check your connection and try again.';
    }
    if (!error.response) {
      return 'Unable to reach the server. Please ensure the backend API is running.';
    }
  }

  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}
