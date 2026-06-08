'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDateFormat, formatDate, dateFormatPlaceholder } from '@/lib/date';
import { getKenyaHoliday } from '@/lib/kenya-holidays';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** Disable Kenyan national public holidays — used for court event pickers. */
  blockHolidays?: boolean;
}

const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function DatePicker({ value, onChange, label, placeholder, blockHolidays = false }: Props) {
  const dateFormat = useDateFormat();
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [posStyle, setPosStyle] = useState<React.CSSProperties>({});
  const [viewDate, setViewDate] = useState(() => value ? new Date(value) : new Date());
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const computePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popHeight = 370;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < popHeight && spaceAbove > spaceBelow;
    setDropUp(openUp);

    // On small screens, center horizontally
    const isMobile = window.innerWidth < 400;
    const popWidth = Math.min(320, window.innerWidth - 16);

    if (isMobile) {
      setPosStyle({
        position: 'fixed',
        left: `${(window.innerWidth - popWidth) / 2}px`,
        width: `${popWidth}px`,
        ...(openUp
          ? { bottom: `${window.innerHeight - rect.top + 6}px` }
          : { top: `${rect.bottom + 6}px` }),
      });
    } else {
      // Clamp left so the popover doesn't overflow the right edge
      const idealLeft = rect.left;
      const maxLeft = window.innerWidth - popWidth - 8;
      setPosStyle({
        position: 'fixed',
        left: `${Math.max(8, Math.min(idealLeft, maxLeft))}px`,
        width: `${popWidth}px`,
        ...(openUp
          ? { bottom: `${window.innerHeight - rect.top + 6}px` }
          : { top: `${rect.bottom + 6}px` }),
      });
    }
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Reposition on open, scroll, resize
  useEffect(() => {
    if (!open) return;
    computePosition();
    const reposition = () => computePosition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, computePosition]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const decadeStart = Math.floor(year / 10) * 10;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goYearsBack = () => setViewDate(new Date(year - 10, month, 1));
  const goYearsFwd = () => setViewDate(new Date(year + 10, month, 1));

  const selectDate = (day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${year}-${m}-${d}`;
    if (blockHolidays && getKenyaHoliday(dateStr)) return;
    onChange(dateStr);
    setOpen(false);
  };

  const selectMonth = (m: number) => {
    setViewDate(new Date(year, m, 1));
    setViewMode('days');
  };

  const selectYear = (y: number) => {
    setViewDate(new Date(y, month, 1));
    setViewMode('months');
  };

  const handleOpen = () => {
    if (value) setViewDate(new Date(value));
    setViewMode('days');
    setOpen(!open);
  };

  const displayValue = value ? formatDate(value, dateFormat) : '';
  const emptyPlaceholder = placeholder ?? dateFormatPlaceholder(dateFormat);

  return (
    <div ref={wrapperRef}>
      {label && <label className="block text-sm font-medium text-foreground/80 mb-1">{label}</label>}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-card-bg border border-border rounded-xl hover:border-primary/50 focus:outline-none focus:border-primary transition-colors text-sm text-left"
      >
        <svg className="w-4 h-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className={`flex-1 ${value ? 'text-foreground' : 'text-muted'}`}>{displayValue || emptyPlaceholder}</span>
        {value && (
          <span
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            className="w-4 h-4 flex items-center justify-center text-muted hover:text-foreground rounded-full hover:bg-background transition-colors cursor-pointer"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </span>
        )}
      </button>

      {open && createPortal(
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 z-[99] sm:hidden" onClick={() => setOpen(false)} />
          <div
            ref={popoverRef}
            style={posStyle}
            className={`bg-card-bg rounded-2xl border border-border shadow-xl z-[100] p-3 sm:p-4 animate-in ${dropUp ? 'fade-in slide-in-from-bottom-2' : 'fade-in slide-in-from-top-2'}`}
          >
            {viewMode === 'days' && (
              <>
                {/* Header: << < Month Year > >> */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <button type="button" onClick={() => setViewDate(new Date(year - 1, month, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background active:bg-gray-100 transition-colors text-muted" title="Previous year">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                    </button>
                    <button type="button" onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background active:bg-gray-100 transition-colors text-muted" title="Previous month">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                  </div>
                  <button type="button" onClick={() => setViewMode('months')} className="text-sm font-semibold text-foreground hover:bg-background px-3 py-1.5 rounded-lg transition-colors">
                    {monthNames[month]} {year}
                  </button>
                  <div className="flex items-center">
                    <button type="button" onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background active:bg-gray-100 transition-colors text-muted" title="Next month">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <button type="button" onClick={() => setViewDate(new Date(year + 1, month, 1))} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background active:bg-gray-100 transition-colors text-muted" title="Next year">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-1">
                  {weekdays.map((d) => (
                    <div key={d} className="text-center text-[11px] font-medium text-muted py-1">{d}</div>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7">
                  {/* Trailing days from previous month */}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`prev-${i}`} className="flex items-center justify-center h-9 sm:h-10 text-sm text-muted/30">
                      {prevMonthDays - firstDay + 1 + i}
                    </div>
                  ))}
                  {/* Current month days */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const m = String(month + 1).padStart(2, '0');
                    const d = String(day).padStart(2, '0');
                    const dateStr = `${year}-${m}-${d}`;
                    const isSelected = dateStr === value;
                    const isToday = dateStr === todayStr;
                    const holidayName = getKenyaHoliday(dateStr);
                    const isBlocked = blockHolidays && !!holidayName;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => selectDate(day)}
                        disabled={isBlocked}
                        title={holidayName ? `Public Holiday: ${holidayName}` : undefined}
                        className={`h-9 sm:h-10 flex items-center justify-center text-sm rounded-lg transition-all ${
                          isSelected
                            ? 'bg-primary text-white font-semibold shadow-sm'
                            : isBlocked
                            ? 'bg-rose-50 text-rose-300 line-through cursor-not-allowed'
                            : holidayName
                            ? 'text-rose-600 font-medium hover:bg-rose-50'
                            : isToday
                            ? 'bg-primary/10 text-primary font-semibold ring-1 ring-primary/30'
                            : 'text-foreground hover:bg-background active:bg-gray-100'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
                  <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="text-xs text-muted hover:text-foreground px-2 py-1.5 rounded-lg hover:bg-background transition-colors">
                    Clear
                  </button>
                  <button
                    type="button"
                    disabled={blockHolidays && !!getKenyaHoliday(todayStr)}
                    onClick={() => { onChange(todayStr); setOpen(false); }}
                    className="text-xs text-primary font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Today
                  </button>
                </div>
              </>
            )}

            {viewMode === 'months' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={() => setViewDate(new Date(year - 1, month, 1))} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-background active:bg-gray-100 transition-colors text-muted">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button type="button" onClick={() => setViewMode('years')} className="text-sm font-semibold text-foreground hover:bg-background px-3 py-1.5 rounded-lg transition-colors">
                    {year}
                  </button>
                  <button type="button" onClick={() => setViewDate(new Date(year + 1, month, 1))} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-background active:bg-gray-100 transition-colors text-muted">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {monthNamesShort.map((m, i) => {
                    const isCurrent = i === month && year === viewDate.getFullYear();
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => selectMonth(i)}
                        className={`py-3 text-sm rounded-lg transition-all ${
                          isCurrent
                            ? 'bg-primary text-white font-semibold shadow-sm'
                            : 'text-foreground hover:bg-background active:bg-gray-100'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {viewMode === 'years' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={goYearsBack} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-background active:bg-gray-100 transition-colors text-muted">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <span className="text-sm font-semibold text-foreground">{decadeStart} &ndash; {decadeStart + 9}</span>
                  <button type="button" onClick={goYearsFwd} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-background active:bg-gray-100 transition-colors text-muted">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const y = decadeStart - 1 + i;
                    const isCurrent = y === year;
                    const isOutOfRange = i === 0 || i === 11;
                    return (
                      <button
                        key={y}
                        type="button"
                        onClick={() => selectYear(y)}
                        className={`py-3 text-sm rounded-lg transition-all ${
                          isCurrent
                            ? 'bg-primary text-white font-semibold shadow-sm'
                            : isOutOfRange
                            ? 'text-muted/40 hover:bg-background'
                            : 'text-foreground hover:bg-background active:bg-gray-100'
                        }`}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
