import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Money } from '../../components/Money';
import { Spinner } from '../../components/Spinner';
import { StatusBadge } from '../../components/StatusBadge';
import { asApiError } from '../../lib/api/client';
import { cancelOrder, getOrder, reconcileOrder } from '../../lib/api/endpoints';
import type { ApiError } from '../../lib/api/client';
import { formatDateTime, formatKg } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../auth/AuthProvider';
import { InvoiceDownloadButton } from '../invoices/InvoiceDownloadButton';
import { orderActions } from './orderActions';

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const { organization } = useAuth();
  const role = organization?.role ?? 'buyer';

  const order = useAsync(() => getOrder(orderId), [orderId]);
  const [busy, setBusy] = useState<'cancel' | 'check' | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [checkNote, setCheckNote] = useState<string | null>(null);

  if (order.error && !order.data) {
    return (
      <section>
        <h1>Order</h1>
        <ErrorBanner error={order.error} onRetry={order.reload} />
        <Link to="/orders">Back to orders</Link>
      </section>
    );
  }
  if (!order.data) return <Spinner label="Loading order…" />;

  const current = order.data;
  const actions = orderActions(current.status, role);

  async function onCancel() {
    setBusy('cancel');
    setActionError(null);
    try {
      order.setData(await cancelOrder(current.id));
    } catch (e) {
      setActionError(asApiError(e));
    } finally {
      setBusy(null);
    }
  }

  async function onCheckPayment() {
    setBusy('check');
    setActionError(null);
    setCheckNote(null);
    try {
      const next =
        actions.checkPaymentMode === 'reconcile'
          ? await reconcileOrder(current.id)
          : await getOrder(current.id);
      order.setData(next);
      if (next.status === 'payment_pending') {
        setCheckNote('The payment is still being confirmed. Please check again in a moment.');
      }
    } catch (e) {
      setActionError(asApiError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <p>
        <Link to="/orders">&larr; Orders</Link>
      </p>
      <div className="page-head">
        <h1>Order {current.number}</h1>
        <StatusBadge status={current.status} />
      </div>
      <p className="muted">Placed {formatDateTime(current.created_at)}</p>

      {current.status === 'payment_pending' && (
        <div className="banner banner-warning" role="status">
          <div>
            <p>We&apos;re confirming your payment. Your order is saved and the stock is held for you.</p>
            {checkNote && <p className="banner-meta">{checkNote}</p>}
          </div>
          {actions.canCheckPayment && (
            <Button variant="secondary" loading={busy === 'check'} onClick={onCheckPayment}>
              Check payment status
            </Button>
          )}
        </div>
      )}
      {current.status === 'payment_failed' && (
        <div className="banner banner-error" role="status">
          Payment was declined for this order. No charge was made.
        </div>
      )}
      {current.status === 'review_required' && (
        <div className="banner banner-warning" role="status">
          Your payment was received but we could not complete the order automatically. Our team will
          review it.
        </div>
      )}
      {current.status === 'cancelled' && (
        <div className="banner banner-info" role="status">
          This order was cancelled.
        </div>
      )}
      {actionError && <ErrorBanner error={actionError} />}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">Quantity</th>
              <th className="num">Price</th>
              <th className="num">Line total</th>
            </tr>
          </thead>
          <tbody>
            {current.lines.map((line) => (
              <tr key={line.product_id}>
                <td>
                  {line.name}
                  <div className="muted small">{line.sku}</div>
                </td>
                <td className="num">{formatKg(line.quantity_kg)}</td>
                <td className="num">
                  <Money value={line.unit_price} /> / kg
                </td>
                <td className="num">
                  <Money value={line.line_total} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total</td>
              <td className="num">
                <Money value={current.total} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="actions">
        {current.invoice_id && (
          <InvoiceDownloadButton
            invoiceId={current.invoice_id}
            invoiceNumber={`INV-${current.number.replace(/\D/g, '')}`}
          />
        )}
        {actions.canCancel && (
          <Button variant="danger" loading={busy === 'cancel'} onClick={onCancel}>
            Cancel order
          </Button>
        )}
      </div>
    </section>
  );
}
