'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from './api';

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
  };
  roles?: Array<{ id: number; name: string; permissions: Array<{ name: string }> }>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
  logout: () => void;
  loading: boolean;
  switchLocation: (locationId: number) => Promise<void>;
  can: (permission: string) => boolean;
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    const stored = localStorage.getItem('firmly_token');
    if (stored) {
      setToken(stored);
      fetchUser(stored).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: User; token: string }>('/login', { email, password });
    setUser(res.user);
    setToken(res.token);
    localStorage.setItem('firmly_token', res.token);
  };

  const register = async (data: Record<string, unknown>) => {
    const res = await api.post<{ user: User; token: string }>('/register', data);
    setUser(res.user);
    setToken(res.token);
    localStorage.setItem('firmly_token', res.token);
  };

  const switchLocation = async (locationId: number) => {
    if (!token) return;
    const res = await api.post<{ active_location: ActiveLocation }>(`/locations/${locationId}/set-active`, undefined, token);
    setUser((prev) => prev ? { ...prev, active_location: res.active_location } : null);
  };

  const logout = useCallback(async () => {
    try {
      if (token) await api.post('/logout', undefined, token);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('firmly_token');
      setToken(null);
      setUser(null);
    }
  }, [token]);

  // Auto-logout after 2 hours of inactivity
  useEffect(() => {
    if (!token) return;

    const IDLE_TIMEOUT = 2 * 60 * 60 * 1000; // 2 hours in ms
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        logout();
      }, IDLE_TIMEOUT);
    };

    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
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
    <AuthContext.Provider value={{ user, token, login, register, logout, loading, switchLocation, can, isOwner }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
