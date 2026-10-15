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

// ── 401 handling + error normalisation ───────────────────
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('tt_token');
      localStorage.removeItem('tt_user');
      // Redirect to login without a hard reload when possible
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    return Promise.reject(error);
  },
);

// ── Helper to extract a human-readable error message ──────
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = (error as AxiosError<ApiError>).response?.data;
    if (data?.detail) return data.detail;
    if (data?.title) return data.title;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred.';
}
