import { useCallback, useEffect, useState } from 'react';
import {
  fetchMe, getAuthStatus, getToken, login as apiLogin, register as apiRegister,
  setToken, type AuthStatus, type AuthUser,
} from '../lib/api';

export interface AuthState {
  status: AuthStatus | null;
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string, displayName: string) => Promise<string | null>;
  logout: () => void;
  refresh: () => Promise<void>;
}

/** App-wide auth. When the backend has auth disabled, status.auth_enabled is
 *  false and every route stays public (single-user legacy mode). */
export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await getAuthStatus();
      setStatus(s);
      if (s.auth_enabled && getToken()) {
        try {
          setUser(await fetchMe());
        } catch {
          setToken(null);
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setStatus(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const r = await apiLogin({ email, password });
      setToken(r.access_token);
      setUser(r.user);
      return null;
    } catch (e) {
      return authErrorMessage(e);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    try {
      const r = await apiRegister({ email, password, display_name: displayName });
      setToken(r.access_token);
      setUser(r.user);
      return null;
    } catch (e) {
      return authErrorMessage(e);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    window.location.hash = '#/login';
  }, []);

  return { status, user, loading, login, register, logout, refresh };
}

/** Pure helpers (exported for tests). */

/** True when the route guard must force the login screen. */
export function isLockedOut(status: AuthStatus | null, user: AuthUser | null): boolean {
  return !!status?.auth_enabled && !user;
}

export function authErrorMessage(e: unknown): string {  const r = (e as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  if (!r) return 'Backend unreachable';
  const detail = r.data?.detail;
  if (typeof detail === 'string') return detail;
  if (r.status === 401) return 'Invalid email or password';
  if (r.status === 403) return typeof detail === 'string' ? detail : 'Forbidden';
  if (r.status === 409) return 'Email already registered';
  return 'Something went wrong';
}
