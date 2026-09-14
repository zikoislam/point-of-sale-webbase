'use client';

import { useCallback, useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/**
 * Fetches one report endpoint with the shared cookie session.
 * Every /reports/* page uses this so loading and error handling stay identical.
 */
export function useReportData<T>(
  endpoint: string,
  startDate?: string,
  endDate?: string,
  withDateFilter = true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = withDateFilter
        ? new URLSearchParams({
            ...(startDate ? { startDate } : {}),
            ...(endDate ? { endDate } : {}),
          }).toString()
        : '';

      const res = await fetch(`${API}${endpoint}${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();

      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message || 'Failed to load this report');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load this report');
    } finally {
      setLoading(false);
    }
  }, [endpoint, startDate, endDate, withDateFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

export { API as REPORT_API };
