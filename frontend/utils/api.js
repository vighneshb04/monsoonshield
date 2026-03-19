/**
 * API client with JWT token injection
 */
import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT token on every request
api.interceptors.request.use((config) => {
  const token = Cookies.get('token') || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('token');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
};

// ─── Zones ────────────────────────────────────────────────────────────────────
export const zonesAPI = {
  getAll: ()       => api.get('/zones'),
  getOne: (id)     => api.get(`/zones/${id}`),
};

// ─── Premium ──────────────────────────────────────────────────────────────────
export const premiumAPI = {
  calculate: (params) => api.get('/premium/calculate', { params }),
};

// ─── Policy ───────────────────────────────────────────────────────────────────
export const policyAPI = {
  create: (data) => api.post('/policy/create', data),
  getMy:  ()     => api.get('/policy/my'),
};

// ─── Claims ───────────────────────────────────────────────────────────────────
export const claimAPI = {
  getMy:  ()                => api.get('/claim/my'),
  getAll: (params)          => api.get('/claim/all', { params }),
  updateStatus: (id, data)  => api.patch(`/claim/${id}/status`, data),
  triggerAuto: ()           => api.post('/claim/auto'),
};

// ─── Payout ───────────────────────────────────────────────────────────────────
export const payoutAPI = {
  process: (claim_id)  => api.post('/payout/process', { claim_id }),
  getMy:   ()          => api.get('/payout/my'),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  worker: () => api.get('/dashboard/worker'),
  admin:  () => api.get('/dashboard/admin'),
};

// ─── Trigger ──────────────────────────────────────────────────────────────────
export const triggerAPI = {
  check:         (zone_id) => api.post('/trigger/check', { zone_id }),
  simulateFlood: (zone_id) => api.post('/trigger/simulate-flood', { zone_id }),
};

// ─── Weather ──────────────────────────────────────────────────────────────────
export const weatherAPI = {
  getZone:  (zone_id) => api.get(`/weather/zone/${zone_id}`),
  refresh:  ()        => api.post('/weather/refresh'),
};

export default api;
