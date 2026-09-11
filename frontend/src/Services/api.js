import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'vestra.auth';
export const AUTH_CLEARED_EVENT = 'vestra:auth-cleared';
const config = {
  baseURL: import.meta.env?.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
};

function readTokens() {
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY));
    return typeof saved?.access === 'string' && saved.access && typeof saved?.refresh === 'string' && saved.refresh ? saved : null;
  } catch {
    return null;
  }
}

let tokens = readTokens();
let sessionVersion = 0;
let refreshPromise = null;
let refreshController = null;
const api = axios.create(config);
const refreshApi = axios.create(config);

export function getAuthTokens() {
  return tokens;
}

export function setAuthTokens(nextTokens) {
  sessionVersion += 1;
  refreshController?.abort();
  refreshController = null;
  refreshPromise = null;
  tokens = { access: nextTokens.access, refresh: nextTokens.refresh };
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
  } catch {
    // Private browser modes can disable storage. The current session still works.
  }
}

export function clearAuthTokens() {
  sessionVersion += 1;
  refreshController?.abort();
  refreshController = null;
  refreshPromise = null;
  tokens = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem('vestra.user');
  } catch {
    // In-memory authentication does not depend on persistent storage.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  if (!tokens?.refresh) {
    clearAuthTokens();
    throw new Error('Your session has ended. Please sign in again.');
  }
  const version = sessionVersion;
  const refresh = tokens.refresh;
  const controller = new AbortController();
  refreshController = controller;
  const pending = refreshApi.post('/users/refresh/', { refresh }, { signal: controller.signal })
    .then(({ data }) => {
      if (version !== sessionVersion || controller.signal.aborted) {
        throw new axios.CanceledError('Session changed during refresh.');
      }
      if (!data.access) {
        clearAuthTokens();
        throw new Error('Your session has ended. Please sign in again.');
      }
      // A refresh belongs to the same session; do not invalidate waiting requests.
      tokens = { access: data.access, refresh: data.refresh || refresh };
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
      } catch { /* Storage is optional. */ }
      return { access: data.access, version };
    })
    .catch((error) => {
      if (version === sessionVersion && [400, 401, 403].includes(error.response?.status)) {
        clearAuthTokens();
      }
      throw error;
    })
    .finally(() => {
      if (refreshPromise === pending) {
        refreshPromise = null;
        refreshController = null;
      }
    });
  refreshPromise = pending;
  return pending;
}

api.interceptors.request.use((request) => {
  if (!request.skipAuth && tokens?.access) {
    request.headers.Authorization = `Bearer ${tokens.access}`;
    request._sessionVersion = sessionVersion;
  }
  return request;
});

api.interceptors.response.use((response) => response, async (error) => {
  const request = error.config;
  if (!request || request.skipAuth || request.skipRefresh || error.response?.status !== 401) {
    return Promise.reject(error);
  }
  if (request._sessionVersion !== undefined && request._sessionVersion !== sessionVersion) {
    return Promise.reject(new axios.CanceledError('This request belongs to a previous session.'));
  }
  if (request._retry) {
    clearAuthTokens();
    return Promise.reject(error);
  }
  if (!tokens?.refresh) return Promise.reject(error);
  request._retry = true;
  // Another response may already have refreshed this token before this 401
  // arrived. Retry with that access token instead of rotating refresh twice.
  if (request.headers.Authorization !== `Bearer ${tokens.access}`) {
    request.headers.Authorization = `Bearer ${tokens.access}`;
    return api(request);
  }
  try {
    const refreshed = await refreshAccessToken();
    if (refreshed.version !== sessionVersion || !tokens) {
      return Promise.reject(new axios.CanceledError('Session ended before retry.'));
    }
    request.headers.Authorization = `Bearer ${refreshed.access}`;
    return api(request);
  } catch (refreshError) {
    return Promise.reject(refreshError);
  }
});

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_STORAGE_KEY) return;
    sessionVersion += 1;
    refreshController?.abort();
    refreshController = null;
    refreshPromise = null;
    tokens = readTokens();
    if (!tokens) window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
  });
}

/** Keep API failures useful and avoid exposing backend HTML or internal errors. */
export function getApiError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error.response) {
    return 'We could not connect to Vestra. Check your connection and try again.';
  }
  if (error.response.status >= 500) return 'Vestra is temporarily unavailable. Please try again shortly.';
  const data = error.response.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.non_field_errors)) return data.non_field_errors.join(' ');
  return fallback;
}

export const errorMessage = getApiError;

export default api;
