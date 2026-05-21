'use client';

import { useCallback } from 'react';
import { useAuth } from './auth-context';

export const DEFAULT_DATE_FORMAT = 'm/d/Y';

/**
 * Format a date using PHP-style tokens. Supports the 5 formats configured
 * server-side: m/d/Y, d/m/Y, m-d-Y, d-m-Y, Y-m-d. Tokens recognised: Y, m, d.
 */
export function formatDate(value: string | Date | null | undefined, format: string = DEFAULT_DATE_FORMAT): string {
  if (!value) return '';
  const d = typeof value === 'string'
    ? new Date(value.includes('T') ? value : value + 'T00:00:00')
    : value;
  if (Number.isNaN(d.getTime())) return '';
  const Y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return format.replace(/Y/g, Y).replace(/m/g, m).replace(/d/g, day);
}

/**
 * Translate a PHP-style date format into a placeholder mask (e.g. DD/MM/YYYY).
 */
export function dateFormatPlaceholder(format: string = DEFAULT_DATE_FORMAT): string {
  return format.replace(/Y/g, 'YYYY').replace(/m/g, 'MM').replace(/d/g, 'DD');
}

/** Hook returning the user's chosen date format (with safe default). */
export function useDateFormat(): string {
  const { user } = useAuth();
  return user?.business?.date_format || DEFAULT_DATE_FORMAT;
}

/** Hook returning a formatter bound to the user's chosen date format. */
export function useFormatDate(): (value: string | Date | null | undefined) => string {
  const fmt = useDateFormat();
  return useCallback((value) => formatDate(value, fmt), [fmt]);
}
