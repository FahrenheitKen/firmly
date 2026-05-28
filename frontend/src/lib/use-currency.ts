import { useCallback } from 'react';
import { useAuth } from './auth-context';

export function useCurrency() {
  const { user } = useAuth();
  const symbol = user?.business?.currency?.symbol || '';

  const formatMoney = useCallback(
    (value: string | number): string => {
      const num = typeof value === 'string' ? Number(value) : value;
      const formatted = num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return symbol ? `${symbol} ${formatted}` : formatted;
    },
    [symbol],
  );

  return { symbol, formatMoney };
}
