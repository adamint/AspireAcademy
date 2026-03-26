import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? 'unknown';
    const method = error.config?.method?.toUpperCase() ?? 'UNKNOWN';
    const status = error.response?.status ?? 'no response';
    const body = error.response?.data ?? null;
    console.error(`[API Error] ${method} ${url} → ${status}`, body);

    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    // Also logout if /me returns 404 (user deleted from DB but JWT still valid)
    if (error.response?.status === 404 && url?.includes('/auth/me')) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default api;
