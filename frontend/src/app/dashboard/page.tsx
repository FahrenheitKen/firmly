'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/page-header';
import Modal from '@/components/ui/modal';
import { getKenyaHoliday, getKenyaHolidaysInRange } from '@/lib/kenya-holidays';

interface CalendarEvent {
  id: number;
  case_id: number;
  event_type: string;
  event_date: string;
  case?: {
    id: number;
    case_number: string;
    title: string;
    assigned_to?: { id: number; first_name: string; last_name: string | null } | null;
  } | null;
}

const eventTypeColors: Record<string, string> = {
  'Bring Up': 'bg-blue-100 text-blue-700 border-blue-200',
  'Mention': 'bg-amber-100 text-amber-700 border-amber-200',
  'Mention of Application': 'bg-orange-100 text-orange-700 border-orange-200',
  'Hearing': 'bg-purple-100 text-purple-700 border-purple-200',
  'Hearing of Application': 'bg-violet-100 text-violet-700 border-violet-200',
  'Ruling': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Judgement': 'bg-rose-100 text-rose-700 border-rose-200',
};

const legendDotColors: Record<string, string> = {
  'Bring Up': 'bg-blue-500',
  'Mention': 'bg-amber-500',
  'Mention of Application': 'bg-orange-500',
  'Hearing': 'bg-purple-500',
  'Hearing of Application': 'bg-violet-500',
  'Ruling': 'bg-emerald-500',
  'Judgement': 'bg-rose-500',
};

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function eventDateKey(iso: string): string {
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

export default function DashboardPage() {
  const { user, token, can, isOwner } = useAuth();
  const canSeeAllCases = isOwner || can('case.view_all') || can('case.view');
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const monthEnd = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), [cursor]);

  const gridStart = useMemo(() => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [monthStart]);

  const gridDays = useMemo(() => {
    const days: Date[] = [];
    const d = new Date(gridStart);
    for (let i = 0; i < 42; i++) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  }, [gridStart]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    const from = toDateKey(gridStart);
    const lastDay = new Date(gridStart);
    lastDay.setDate(lastDay.getDate() + 41);
    const to = toDateKey(lastDay);
    api.get<{ events: CalendarEvent[] }>(`/events?from=${from}&to=${to}`, token)
      .then((res) => setEvents(res.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [token, gridStart]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const e of events) {
      const key = eventDateKey(e.event_date);
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [events]);

  const todayKey = toDateKey(new Date());
  const monthLabel = monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];
  const monthHolidays = useMemo(
    () => getKenyaHolidaysInRange(toDateKey(monthStart), toDateKey(monthEnd)),
    [monthStart, monthEnd],
  );

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.first_name}!`}
        description="Upcoming case events at your firm."
      />

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        <div className="lg:col-span-7 bg-card-bg rounded-xl border border-border p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg border border-border hover:bg-gray-50 transition-colors"
                aria-label="Previous month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                className="p-1.5 rounded-lg border border-border hover:bg-gray-50 transition-colors"
                aria-label="Next month"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
              <button
                onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); }}
                className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Today
              </button>
            </div>
            <h2 className="text-base sm:text-lg font-semibold">{monthLabel}</h2>
            <div className="text-xs text-muted">
              {loading ? 'Loading...' : `${events.length} event${events.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {weekdayLabels.map((label) => (
              <div key={label} className="bg-gray-50 px-2 py-2 text-xs font-medium text-muted text-center">
                {label}
              </div>
            ))}
            {gridDays.map((day) => {
              const key = toDateKey(day);
              const inMonth = day.getMonth() === monthStart.getMonth();
              const isToday = key === todayKey;
              const dayEvents = eventsByDate[key] || [];
              const hasEvents = dayEvents.length > 0;
              const holidayName = getKenyaHoliday(key);
              return (
                <button
                  key={key}
                  onClick={() => { if (hasEvents) setSelectedDate(key); }}
                  disabled={!hasEvents}
                  title={holidayName ? `Public Holiday: ${holidayName}` : undefined}
                  className={`min-h-[60px] sm:min-h-[88px] p-1 sm:p-1.5 text-left flex flex-col gap-0.5 sm:gap-1 transition-colors ${
                    holidayName ? 'bg-rose-50/60' : 'bg-card-bg'
                  } ${hasEvents ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'} ${inMonth ? '' : 'opacity-40'}`}
                >
                  <div className={`text-xs font-medium ${
                    isToday
                      ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white'
                      : holidayName
                      ? 'text-rose-700'
                      : 'text-foreground'
                  }`}>
                    {day.getDate()}
                  </div>
                  {holidayName && (
                    <span className="text-[10px] leading-tight text-rose-700 font-medium truncate hidden sm:block" title={holidayName}>
                      {holidayName}
                    </span>
                  )}
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <div className="hidden sm:flex flex-col gap-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className={`text-[10px] leading-tight px-1.5 py-0.5 rounded border truncate ${
                            eventTypeColors[e.event_type] || 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                          title={`${e.event_type} — ${e.case?.case_number || ''}`}
                        >
                          {e.case?.case_number || e.event_type}
                        </span>
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-muted px-1">+{dayEvents.length - 3} more</span>
                      )}
                    </div>
                    {hasEvents && (
                      <div className="flex gap-0.5 sm:hidden flex-wrap">
                        {dayEvents.slice(0, 3).map((e) => (
                          <span
                            key={e.id}
                            className={`w-1.5 h-1.5 rounded-full ${
                              legendDotColors[e.event_type] || 'bg-gray-400'
                            }`}
                            title={`${e.event_type} — ${e.case?.case_number || ''}`}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] text-muted">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="lg:col-span-3 bg-card-bg rounded-xl border border-border p-4 sm:p-5 h-fit">
          <h3 className="text-sm font-semibold mb-1">Event Legend</h3>
          <p className="text-xs text-muted mb-4">Colors used on the calendar.</p>
          <ul className="space-y-2.5">
            {Object.keys(legendDotColors).map((type) => (
              <li key={type} className="flex items-center gap-2.5">
                <span className={`w-3 h-3 rounded-full ${legendDotColors[type]}`} />
                <span className="text-sm text-foreground">{type}</span>
              </li>
            ))}
            <li className="flex items-center gap-2.5 pt-2 mt-2 border-t border-border/60">
              <span className="w-3 h-3 rounded-sm bg-rose-200 border border-rose-300" />
              <span className="text-sm text-foreground">Kenyan public holiday</span>
            </li>
          </ul>
          <p className="text-[11px] text-muted mt-3 leading-snug">
            Events cannot be scheduled on Kenyan national public holidays.
          </p>

          <div className="mt-5 pt-4 border-t border-border/60">
            <h3 className="text-sm font-semibold mb-2">Public holidays this month</h3>
            {monthHolidays.length === 0 ? (
              <p className="text-xs text-muted">No public holidays in {monthLabel}.</p>
            ) : (
              <ul className="space-y-2">
                {monthHolidays.map((h) => (
                  <li key={h.date} className="flex items-start gap-2.5">
                    <span className="text-xs font-medium text-rose-700 shrink-0 w-12 tabular-nums">
                      {new Date(h.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </span>
                    <span className="text-xs text-foreground">{h.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={!!selectedDate && selectedEvents.length > 0}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? new Date(selectedDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
        size="lg"
      >
        <ul className="divide-y divide-border">
          {selectedEvents.map((e) => (
            <li key={e.id}>
              <Link
                href={`/dashboard/cases/${e.case_id}`}
                onClick={() => setSelectedDate(null)}
                className="flex items-center gap-3 py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <span className={`text-xs px-2 py-0.5 rounded border ${eventTypeColors[e.event_type] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  {e.event_type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{e.case?.case_number || 'Case'}</p>
                  <p className="text-xs text-muted truncate">{e.case?.title || ''}</p>
                  {canSeeAllCases && (
                    <p className="text-xs text-muted truncate mt-0.5">
                      Assigned to: {e.case?.assigned_to
                        ? `${e.case.assigned_to.first_name} ${e.case.assigned_to.last_name || ''}`.trim()
                        : 'Unassigned'}
                    </p>
                  )}
                </div>
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
