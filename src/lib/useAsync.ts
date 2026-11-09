import { useCallback, useEffect, useState } from 'react';
import type { DependencyList } from 'react';
import { asApiError } from './api/client';
import type { ApiError } from './api/client';

interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
}

export function useAsync<T>(load: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      },
      (error: unknown) => {
        if (!cancelled) setState((s) => ({ ...s, error: asApiError(error), loading: false }));
      },
    );
    return () => {
      cancelled = true;
    };
    // `load` is recreated every render; callers list what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setData = useCallback((data: T) => setState((s) => ({ ...s, data })), []);

  return { ...state, reload, setData };
}
