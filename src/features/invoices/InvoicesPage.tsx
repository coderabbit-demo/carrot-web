import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Money } from '../../components/Money';
import { Spinner } from '../../components/Spinner';
import { listInvoices } from '../../lib/api/endpoints';
import { formatDateTime } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { InvoiceDownloadButton } from './InvoiceDownloadButton';
import { InvoiceFilters } from './InvoiceFilters';
import { Pagination } from './Pagination';
import { SortableHeader } from './SortableHeader';
import { buildInvoicesCsv, exportFilename, saveCsv } from './invoicesCsv';
import { PAGE_SIZES, hasActiveFilters, runInvoiceQuery, toggleSort } from './invoicesQuery';
import { useInvoiceQueryParams } from './useInvoiceQueryParams';
import './invoices.css';

// Search, sorting and paging all happen in the browser over this many most recent invoices.
// The gateway rejects a limit above 100 with 400 validation_failed, so this is its maximum.
const FETCH_LIMIT = 100;

export function InvoicesPage() {
  const invoices = useAsync(() => listInvoices(FETCH_LIMIT), []);
  const { query, update, reset } = useInvoiceQueryParams();
  const [exportError, setExportError] = useState<string | null>(null);

  const result = useMemo(
    () => (invoices.data ? runInvoiceQuery(invoices.data, query) : null),
    [invoices.data, query],
  );

  function onExport() {
    if (!result || !result.valid) return;
    setExportError(null);
    try {
      saveCsv(exportFilename(new Date()), buildInvoicesCsv(result.rows));
    } catch {
      setExportError('The export could not be created. Please try again.');
    }
  }

  const loaded = invoices.data?.length ?? 0;
  const filtersActive = hasActiveFilters(query);

  return (
    <section>
      <div className="invoices-head">
        <h1>Invoices</h1>
        {result && loaded > 0 && (
          <Button
            variant="secondary"
            disabled={!result.valid || result.rows.length === 0}
            onClick={onExport}
          >
            Export CSV
          </Button>
        )}
      </div>

      {invoices.error && !invoices.data && (
        <ErrorBanner error={invoices.error} onRetry={invoices.reload} />
      )}
      {invoices.loading && !invoices.data && <Spinner label="Loading invoices…" />}
      {exportError && <ErrorBanner error={exportError} />}

      {invoices.data && loaded === 0 && (
        <EmptyState title="No invoices yet">An invoice is issued once an order is paid.</EmptyState>
      )}

      {result && loaded > 0 && (
        <>
          <InvoiceFilters
            query={query}
            issues={result.issues}
            canClear={filtersActive}
            onChange={update}
            onClear={reset}
          />

          {loaded >= FETCH_LIMIT && (
            <p className="muted small">
              Showing the {loaded} most recent invoices. There may be older ones, which are not covered by search, filters or the CSV export.
            </p>
          )}

          {!result.valid && (
            <p className="invoices-hint muted">Fix the highlighted range to see matching invoices.</p>
          )}

          {result.valid && result.rows.length === 0 && (
            <EmptyState title="No invoices match">
              Try a different search or widen the filters.
              {filtersActive && (
                <p>
                  <Button variant="secondary" onClick={reset}>
                    Clear filters
                  </Button>
                </p>
              )}
            </EmptyState>
          )}

          {result.valid && result.rows.length > 0 && (
            <>
              <div className="table-wrap">
                <table className="data-table invoices-table">
                  <caption className="visually-hidden">
                    Invoices, sorted by {query.sort} {query.dir === 'asc' ? 'ascending' : 'descending'}
                  </caption>
                  <thead>
                    <tr>
                      <SortableHeader
                        label="Invoice"
                        sortKey="number"
                        activeSort={query.sort}
                        direction={query.dir}
                        onSort={(key) => update(toggleSort(query, key))}
                      />
                      <th scope="col">Order</th>
                      <SortableHeader
                        label="Issued"
                        sortKey="issued"
                        activeSort={query.sort}
                        direction={query.dir}
                        onSort={(key) => update(toggleSort(query, key))}
                      />
                      <SortableHeader
                        label="Total"
                        sortKey="total"
                        numeric
                        activeSort={query.sort}
                        direction={query.dir}
                        onSort={(key) => update(toggleSort(query, key))}
                      />
                      <th scope="col">
                        <span className="visually-hidden">Download</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.paged.items.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>{invoice.number}</td>
                        <td>
                          <Link to={`/orders/${invoice.order_id}`}>{invoice.order_number}</Link>
                        </td>
                        <td>{formatDateTime(invoice.issued_at)}</td>
                        <td className="num">
                          <Money value={invoice.total} />
                        </td>
                        <td className="num">
                          <InvoiceDownloadButton
                            invoiceId={invoice.id}
                            invoiceNumber={invoice.number}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={result.paged.page}
                pageCount={result.paged.pageCount}
                pageSize={query.pageSize}
                pageSizes={PAGE_SIZES}
                start={result.paged.start}
                end={result.paged.end}
                total={result.rows.length}
                onPage={(page) => update({ page })}
                onPageSize={(pageSize) => update({ pageSize })}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
