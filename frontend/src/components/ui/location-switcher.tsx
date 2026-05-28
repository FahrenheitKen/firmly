'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLocations } from '@/lib/locations-context';

export default function LocationSwitcher() {
  const { user, switchLocation } = useAuth();
  const { locations, loading: locationsLoading } = useLocations();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const active = user?.active_location;

  // Hide entirely if the user has 0 or 1 location, but only once we've actually
  // resolved the list. While loading, keep showing the active location pill so
  // the sidebar doesn't visibly collapse.
  if (!active) return null;
  if (!locationsLoading && locations.length <= 1) return null;

  const handleSwitch = async (id: number) => {
    if (id === active?.id) { setOpen(false); return; }
    setSwitching(true);
    await switchLocation(id);
    setSwitching(false);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative px-1">
      {/* Trigger card */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/8 hover:bg-white/14 active:bg-white/20 border border-white/12 hover:border-accent/40 transition-all duration-200 group touch-manipulation"
      >
        {/* Pin icon with accent bg */}
        <div className="shrink-0 w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <div className="flex-1 text-left min-w-0">
          <p className="text-[10px] font-medium text-sidebar-text/50 uppercase tracking-wider leading-none mb-0.5">Location</p>
          <p className="text-sm font-semibold text-white truncate leading-tight">
            {switching ? 'Switching…' : (active?.name ?? 'Select')}
          </p>
          {active?.city && (
            <p className="text-[10px] text-accent/70 truncate leading-none mt-0.5">{active.city}</p>
          )}
        </div>

        <svg
          className={`w-3.5 h-3.5 shrink-0 text-sidebar-text/50 group-hover:text-accent transition-all duration-200 ${open ? 'rotate-180 text-accent' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-[fadeIn_0.1s_ease]">
          <div className="px-3 pt-2.5 pb-1.5 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Switch Location</p>
          </div>
          <div className="p-1.5 space-y-0.5 max-h-60 overflow-y-auto overscroll-contain">
            {locations.map((loc) => {
              const isActive = active?.id === loc.id;
              return (
                <button
                  key={loc.id}
                  onClick={() => handleSwitch(loc.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-3 rounded-lg transition-all duration-150 text-left touch-manipulation ${
                    isActive
                      ? 'bg-accent/10 border border-accent/20'
                      : 'hover:bg-gray-50 active:bg-gray-100 border border-transparent'
                  }`}
                >
                  <div className={`shrink-0 w-2 h-2 rounded-full ${isActive ? 'bg-accent' : 'bg-gray-300'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-accent' : 'text-gray-800'}`}>
                      {loc.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{loc.city}</p>
                  </div>
                  {isActive && (
                    <svg className="w-3.5 h-3.5 shrink-0 text-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
