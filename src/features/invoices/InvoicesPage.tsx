import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Money } from '../../components/Money';
import { Spinner } from '../../components/Spinner';
import { listInvoices } from '../../lib/api/endpoints';
import { formatDateTime } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { InvoiceDownloadButton } from './InvoiceDownloadButton';

export function InvoicesPage() {
  const invoices = useAsync(() => listInvoices(), []);

  return (
    <section>
      <h1>Invoices</h1>

      {invoices.error && !invoices.data && (
        <ErrorBanner error={invoices.error} onRetry={invoices.reload} />
      )}
      {invoices.loading && !invoices.data && <Spinner label="Loading invoices…" />}
      {invoices.data && invoices.data.length === 0 && (
        <EmptyState title="No invoices yet">An invoice is issued once an order is paid.</EmptyState>
      )}
      {invoices.data && invoices.data.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Order</th>
                <th>Issued</th>
                <th className="num">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.data.map((invoice) => (
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
                    <InvoiceDownloadButton invoiceId={invoice.id} invoiceNumber={invoice.number} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
