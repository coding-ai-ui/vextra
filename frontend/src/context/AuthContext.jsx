import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api, { AUTH_CLEARED_EVENT, TOKEN_STORAGE_KEY, clearAuthTokens, getAuthTokens, setAuthTokens } from '../Services/api';

const AuthContext = createContext(null);
const USER_STORAGE_KEY = 'vestra.user';

function cachedUser() {
  try {
    return getAuthTokens() ? JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) : null;
  } catch {
    return null;
  }
}

function rememberUser(user) {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch { /* A session can work without local storage. */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(cachedUser);
  const [authLoading, setAuthLoading] = useState(true);
  const operationVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const version = operationVersion.current;
    const clearUser = () => {
      operationVersion.current += 1;
      setUser(null);
      setAuthLoading(false);
    };
    const syncUser = (event) => {
      if (event.key === USER_STORAGE_KEY || event.key === TOKEN_STORAGE_KEY) setUser(cachedUser());
    };
    window.addEventListener(AUTH_CLEARED_EVENT, clearUser);
    window.addEventListener('storage', syncUser);
    async function restoreSession() {
      if (!getAuthTokens()) {
        setAuthLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/users/me/', { signal: controller.signal });
        if (active && version === operationVersion.current) {
          setUser(data);
          rememberUser(data);
        }
      } catch (error) {
        // The interceptor ends invalid sessions. Offline sessions retain the last
        // known profile so a temporary outage does not silently sign someone out.
        if (error.response?.status === 403 && active && version === operationVersion.current) clearAuthTokens();
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    restoreSession();
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener(AUTH_CLEARED_EVENT, clearUser);
      window.removeEventListener('storage', syncUser);
    };
  }, []);

  const login = useCallback(async ({ username, password }) => {
    const version = ++operationVersion.current;
    const { data: tokenData } = await api.post('/users/login/', { username: username.trim(), password }, { skipAuth: true });
    if (version !== operationVersion.current) throw new Error('Sign-in was cancelled. Please try again.');
    setAuthTokens(tokenData);
    try {
      const profile = tokenData.user?.id ? tokenData.user : (await api.get('/users/me/')).data;
      if (version !== operationVersion.current) throw new Error('Sign-in was cancelled. Please try again.');
      rememberUser(profile);
      setUser(profile);
      return profile;
    } catch (error) {
      if (version === operationVersion.current) clearAuthTokens();
      throw error;
    }
  }, []);

  const register = useCallback(async ({ username, email, password }) => {
    await api.post('/users/register/', { username: username.trim(), email: email.trim(), password }, { skipAuth: true });
    try {
      return await login({ username, password });
    } catch (error) {
      error.accountCreated = true;
      throw error;
    }
  }, [login]);

  const logout = useCallback(() => {
    operationVersion.current += 1;
    clearAuthTokens();
    setUser(null);
  }, []);

  const updateUser = useCallback((data) => {
    setUser(current => { const next = { ...current, ...data }; rememberUser(next); return next; });
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user && getAuthTokens()), authLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// oxlint-disable-next-line react/only-export-components -- Keep the provider and its public context hook together.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
