import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../../features/auth/store/auth.store';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 1. Request Interceptor: Attach access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// 2. Response Interceptor: Intercept 401, call refresh, and retry original request
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If 401 and request has not already been retried
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      // Avoid infinite loop on auth endpoints
      const url = originalRequest.url || '';
      if (url.includes('/api/auth/login') || url.includes('/api/auth/refresh')) {
        return Promise.reject(error);
      }

      // If already refreshing, queue this request until refresh completes
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err: unknown) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) {
        isRefreshing = false;
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      try {
        const refreshResponse = await axios.post<{
          success: boolean;
          data: { accessToken: string; refreshToken: string };
        }>(`${BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } =
          refreshResponse.data.data;

        useAuthStore.getState().setTokens(accessToken, newRefreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        processQueue(null, accessToken);
        return apiClient(originalRequest);
      } catch (refreshError: unknown) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
