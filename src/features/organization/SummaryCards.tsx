import { Money } from '../../components/Money';
import { StatusBadge } from '../../components/StatusBadge';
import { ORDER_STATUSES, coverageNote } from './overviewStats';
import type { InvoiceSummary, OrderSummary } from './overviewStats';

interface OrderCardsProps {
  summary: OrderSummary;
  limit: number;
}

export function OrderSummaryCards({ summary, limit }: OrderCardsProps) {
  return (
    <>
      <p className="muted small overview-coverage">{coverageNote('order', summary.orderCount, limit)}</p>
      <dl className="overview-cards" aria-label="Orders by status">
        {ORDER_STATUSES.map((status) => (
          <div className="overview-card" key={status}>
            <dt>
              <StatusBadge status={status} />
            </dt>
            <dd className="overview-figure">{summary.statusCounts[status]}</dd>
          </div>
        ))}
      </dl>

      <h3 className="overview-subhead">Average order value</h3>
      {summary.averages.length === 0 ? (
        <p className="muted">No confirmed orders yet, so there is no average to show.</p>
      ) : (
        <ul className="overview-values">
          {summary.averages.map((entry) => (
            <li key={entry.currency}>
              <span className="overview-figure">
                <Money value={entry.average} />
              </span>
              <span className="muted small">
                across {entry.orderCount} confirmed {entry.orderCount === 1 ? 'order' : 'orders'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface InvoiceCardsProps {
  summary: InvoiceSummary;
  limit: number;
}

export function InvoiceSummaryCards({ summary, limit }: InvoiceCardsProps) {
  return (
    <>
      <p className="muted small overview-coverage">{coverageNote('invoice', summary.invoiceCount, limit)}</p>
      <dl className="overview-cards" aria-label="Invoice totals">
        <div className="overview-card">
          <dt>Invoices</dt>
          <dd className="overview-figure">{summary.invoiceCount}</dd>
        </div>
        <div className="overview-card">
          <dt>Billed total</dt>
          <dd>
            {summary.billed.length === 0 ? (
              <span className="overview-figure muted">None yet</span>
            ) : (
              <ul className="overview-values">
                {summary.billed.map((total) => (
                  <li key={total.currency}>
                    <span className="overview-figure">
                      <Money value={total} />
                    </span>
                    {summary.billed.length > 1 && <span className="muted small">{total.currency}</span>}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>
    </>
  );
}
