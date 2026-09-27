/**
 * api.js — the single place the frontend talks to the backend.
 *
 * A request interceptor attaches the JWT, and a response interceptor turns a
 * 401 into a session logout so an expired token cannot leave the UI showing
 * stale private data.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

export const TOKEN_KEY = 'boda_token';

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 on anything other than the login call itself means the session is over.
    const isLoginAttempt = error.config?.url?.includes('/auth/login');
    if (error.response?.status === 401 && !isLoginAttempt) {
      localStorage.removeItem(TOKEN_KEY);
      // Defer so the app's own router can react rather than fight the reload.
      window.dispatchEvent(new Event('boda:session-expired'));
    }
    return Promise.reject(error);
  }
);

/** Pull a human-readable message out of whatever the API or network returned. */
export function apiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0] ||
    error?.message ||
    fallback
  );
}

export default api;
