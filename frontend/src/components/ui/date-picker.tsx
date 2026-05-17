'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DatePicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date());
  const [viewMode, setViewMode] = useState<'days' | 'years'>('days');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const decadeStart = Math.floor(year / 12) * 12;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const prevYear = () => setViewDate(new Date(year - 1, month, 1));
  const nextYear = () => setViewDate(new Date(year + 1, month, 1));
  const goYearsBack = () => setViewDate(new Date(year - 12, month, 1));
  const goYearsFwd = () => setViewDate(new Date(year + 12, month, 1));

  const selectDate = (day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${year}-${m}-${d}`);
    setOpen(false);
  };

  const selectYear = (y: number) => {
    setViewDate(new Date(y, month, 1));
    setViewMode('days');
  };

  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div ref={wrapperRef}>
      {label && <label className="block text-sm font-medium text-foreground/80 mb-1">{label}</label>}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-card-bg border border-border rounded-xl hover:border-primary/50 focus:outline-none focus:border-primary transition-colors text-sm text-left"
      >
        <svg className="w-4 h-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className={value ? 'text-foreground' : 'text-muted'}>{displayValue || 'Select date'}</span>
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: `${position.top}px`, left: `${position.left}px`, width: 288 }}
          className="bg-card-bg rounded-2xl border border-border shadow-lg z-[100] p-4"
        >
          {viewMode === 'days' ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={prevYear} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background transition-colors text-muted" title="Previous year">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                </button>
                <button type="button" onClick={() => setViewMode('years')} className="text-sm font-semibold text-foreground hover:bg-background px-2 py-1 rounded-lg transition-colors">
                  {months[month]} {year}
                </button>
                <button type="button" onClick={nextYear} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background transition-colors text-muted" title="Next year">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                </button>
              </div>
              <div className="flex items-center justify-between -mt-1 mb-2">
                <button type="button" onClick={prevMonth} className="text-xs text-muted hover:text-foreground px-2 py-0.5 rounded transition-colors">
                  {months[month === 0 ? 11 : month - 1]}
                </button>
                <button type="button" onClick={nextMonth} className="text-xs text-muted hover:text-foreground px-2 py-0.5 rounded transition-colors">
                  {months[month === 11 ? 0 : month + 1]}
                </button>
              </div>

              <div className="grid grid-cols-7 gap-0.5 mb-1">
                {weekdays.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted py-1.5">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const m = String(month + 1).padStart(2, '0');
                  const d = String(day).padStart(2, '0');
                  const dateStr = `${year}-${m}-${d}`;
                  const isSelected = dateStr === value;
                  const isToday = dateStr === todayStr;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => selectDate(day)}
                      className={`w-full aspect-square flex items-center justify-center text-sm rounded-xl transition-all ${
                        isSelected
                          ? 'bg-primary text-white font-medium shadow-sm'
                          : isToday
                          ? 'bg-background text-foreground font-medium'
                          : 'text-foreground/70 hover:bg-background'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 pt-3 border-t border-border/50 flex justify-between">
                <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="text-xs text-muted hover:text-foreground transition-colors">Clear</button>
                <button type="button" onClick={() => { onChange(todayStr); setOpen(false); }} className="text-xs text-foreground font-medium hover:text-muted transition-colors">Today</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={goYearsBack} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background transition-colors text-muted">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                </button>
                <span className="text-sm font-semibold text-foreground">{decadeStart}-{decadeStart + 11}</span>
                <button type="button" onClick={goYearsFwd} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-background transition-colors text-muted">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 12 }).map((_, i) => {
                  const y = decadeStart + i;
                  const isCurrent = y === year;
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => selectYear(y)}
                      className={`py-2.5 text-sm rounded-xl transition-all ${
                        isCurrent
                          ? 'bg-primary text-white font-medium shadow-sm'
                          : 'text-foreground/70 hover:bg-background'
                      }`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
