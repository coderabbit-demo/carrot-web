import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseInvoiceQuery, serializeInvoiceQuery } from './invoiceQueryParams';
import { DEFAULT_QUERY } from './invoicesQuery';
import type { InvoiceQuery } from './invoicesQuery';

interface UpdateOptions {
  /** Typing in a text box should not add a history entry per keystroke. */
  replace?: boolean;
}

/** The invoice list controls, backed by the URL query string. */
export function useInvoiceQueryParams() {
  const [params, setParams] = useSearchParams();
  const query = useMemo(() => parseInvoiceQuery(params), [params]);

  const update = useCallback(
    (patch: Partial<InvoiceQuery>, options: UpdateOptions = {}) => {
      setParams(
        (previous) => {
          const next = { ...parseInvoiceQuery(previous), ...patch };
          // Any change other than paging itself starts again from the first page.
          if (!('page' in patch)) next.page = 1;
          return serializeInvoiceQuery(next);
        },
        { replace: options.replace ?? false },
      );
    },
    [setParams],
  );

  const reset = useCallback(() => {
    setParams(
      (previous) => {
        const current = parseInvoiceQuery(previous);
        // Filters go back to empty; the chosen sort and page size are kept.
        return serializeInvoiceQuery({
          ...DEFAULT_QUERY,
          sort: current.sort,
          dir: current.dir,
          pageSize: current.pageSize,
        });
      },
      { replace: false },
    );
  }, [setParams]);

  return { query, update, reset };
}
