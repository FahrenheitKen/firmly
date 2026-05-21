'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { useAuth } from './auth-context';

export interface Location {
  id: number;
  name: string;
  location_id: string | null;
  landmark: string | null;
  country: string;
  city: string;
  zip_code: string;
  mobile: string | null;
  alternate_number: string | null;
  email: string | null;
  website: string | null;
  is_active: boolean;
  custom_field1: string | null;
  custom_field2: string | null;
  custom_field3: string | null;
  custom_field4: string | null;
}

interface LocationsContextValue {
  locations: Location[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const LocationsContext = createContext<LocationsContextValue | null>(null);

export function LocationsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get<{ locations: Location[] }>('/locations', token);
      setLocations(res.locations);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLocations([]);
      return;
    }
    refresh();
  }, [token, refresh]);

  return (
    <LocationsContext.Provider value={{ locations, loading, refresh }}>
      {children}
    </LocationsContext.Provider>
  );
}

export function useLocations(): LocationsContextValue {
  const ctx = useContext(LocationsContext);
  if (!ctx) throw new Error('useLocations must be used within LocationsProvider');
  return ctx;
}
