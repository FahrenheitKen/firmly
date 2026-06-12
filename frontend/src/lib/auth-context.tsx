'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api, clearApiCache } from './api';

interface ActiveLocation {
  id: number;
  name: string;
  city: string;
  country: string;
}

interface User {
  id: number;
  first_name: string;
  last_name: string | null;
  surname: string | null;
  email: string | null;
  business_id: number;
  allow_login: boolean;
  active_location: ActiveLocation | null;
  business?: {
    id: number;
    name: string;
    owner_id?: number;
    date_format?: string;
    currency?: {
      code: string;
      symbol: string;
    };
  };
  roles?: Array<{ id: number; name: string; permissions: Array<{ name: string }> }>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  mustChangePassword: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
  logout: () => void;
  loading: boolean;
  switchLocation: (locationId: number) => Promise<void>;
  forceChangePassword: (password: string, passwordConfirmation: string) => Promise<void>;
  can: (permission: string) => boolean;
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('firmly_token');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [loading, setLoading] = useState(() => !!readStoredToken());
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const fetchUser = useCallback(async (t: string) => {
    try {
      const res = await api.get<{ user: User }>('/me', t);
      setUser(res.user);
    } catch {
      localStorage.removeItem('firmly_token');
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const stored = readStoredToken();
    if (stored) {
      fetchUser(stored).finally(() => setLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: User; token: string; must_change_password?: boolean }>('/login', { email, password });
    setUser(res.user);
    setToken(res.token);
    setMustChangePassword(!!res.must_change_password);
    localStorage.setItem('firmly_token', res.token);
  };

  const register = async (data: Record<string, unknown>) => {
    const res = await api.post<{ user: User; token: string }>('/register', data);
    setUser(res.user);
    setToken(res.token);
    localStorage.setItem('firmly_token', res.token);
  };

  const forceChangePassword = async (password: string, passwordConfirmation: string) => {
    if (!token) return;
    await api.post('/force-change-password', { password, password_confirmation: passwordConfirmation }, token);
    setMustChangePassword(false);
  };

  const switchLocation = async (locationId: number) => {
    if (!token) return;
    await api.post<{ active_location: ActiveLocation }>(`/locations/${locationId}/set-active`, undefined, token);
    // Reload so every component fetches data scoped to the new location.
    clearApiCache();
    window.location.reload();
  };

  const logout = useCallback(async () => {
    try {
      if (token) await api.post('/logout', undefined, token);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('firmly_token');
      clearApiCache();
      setToken(null);
      setUser(null);
    }
  }, [token]);

  // Auto-logout after 2 hours of inactivity.
  //
  // We deliberately do NOT listen to `mousemove` / `scroll` — those fire dozens
  // of times per second and the old implementation cleared+rescheduled the
  // timer on every fire, which was a constant CPU drain on every page. Discrete
  // input events are enough to detect a live user, and we throttle to at most
  // one reset per minute so this effect stays essentially free.
  useEffect(() => {
    if (!token) return;

    const IDLE_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours
    const RESET_THROTTLE_MS = 60 * 1000;
    let timer: ReturnType<typeof setTimeout>;
    let lastReset = 0;

    const scheduleLogout = () => {
      clearTimeout(timer);
      timer = setTimeout(() => logout(), IDLE_TIMEOUT);
    };

    const onActivity = () => {
      const now = Date.now();
      if (now - lastReset < RESET_THROTTLE_MS) return;
      lastReset = now;
      scheduleLogout();
    };

    const events = ['mousedown', 'keydown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));
    scheduleLogout();

    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, onActivity));
    };
  }, [token, logout]);

  const isOwner = !!user && !!user.business?.owner_id && user.business.owner_id === user.id;

  const can = useCallback((permission: string): boolean => {
    if (!user) return false;
    if (user.business?.owner_id === user.id) return true;
    return user.roles?.some((role) =>
      role.permissions?.some((p) => p.name === permission)
    ) ?? false;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, token, mustChangePassword, login, register, logout, loading, switchLocation, forceChangePassword, can, isOwner }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
