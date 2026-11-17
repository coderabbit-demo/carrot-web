import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Spinner } from '../../components/Spinner';
import { StatusBadge } from '../../components/StatusBadge';
import { asApiError } from '../../lib/api/client';
import { cancelOrder, getOrder, reconcileOrder } from '../../lib/api/endpoints';
import type { ApiError } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { useAuth } from '../auth/AuthProvider';
import { OrderActions } from './detail/OrderActions';
import { OrderLinesTable } from './detail/OrderLinesTable';
import { OrderStatusBanner } from './detail/OrderStatusBanner';
import { checkResultNote, pollingNote, statusBanner } from './detail/orderDetailModel';
import { usePaymentPolling } from './detail/usePaymentPolling';
import { orderActions } from './orderActions';
import './detail/orderDetail.css';

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const { organization } = useAuth();
  const role = organization?.role ?? 'buyer';

  const order = useAsync(() => getOrder(orderId), [orderId]);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [checkNote, setCheckNote] = useState<string | null>(null);

  const polling = usePaymentPolling({
    orderId,
    status: order.data?.status ?? null,
    onOrder: order.setData,
  });

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
  const capabilities = orderActions(current.status, role);
  const banner = statusBanner(current.status);

  async function onCancel() {
    setCancelling(true);
    setActionError(null);
    try {
      order.setData(await cancelOrder(current.id));
    } catch (e) {
      setActionError(asApiError(e));
    } finally {
      setCancelling(false);
    }
  }

  async function onCheckPayment() {
    setActionError(null);
    setCheckNote(null);
    const fetcher =
      capabilities.checkPaymentMode === 'reconcile'
        ? () => reconcileOrder(current.id)
        : () => getOrder(current.id);
    const outcome = await polling.checkNow(fetcher);
    if (outcome.kind === 'error') setActionError(asApiError(outcome.error));
    if (outcome.kind === 'ok') setCheckNote(checkResultNote(outcome.value.status));
  }

  return (
    <section className="order-detail">
      <header className="receipt-header print-only">
        <p className="receipt-brand">Carrot Cart</p>
        {organization && <p>{organization.name}</p>}
        <p>Order receipt</p>
      </header>

      <p className="no-print">
        <Link to="/orders">&larr; Orders</Link>
      </p>
      <div className="page-head">
        <h1>Order {current.number}</h1>
        <StatusBadge status={current.status} />
      </div>
      <p className="muted">Placed {formatDateTime(current.created_at)}</p>

      {banner && (
        <OrderStatusBanner banner={banner} notes={[checkNote, pollingNote(polling.state)]}>
          {capabilities.canCheckPayment && (
            <Button
              variant="secondary"
              loading={polling.inFlight}
              onClick={onCheckPayment}
            >
              Check payment status
            </Button>
          )}
        </OrderStatusBanner>
      )}
      {actionError && <ErrorBanner error={actionError} />}

      <OrderLinesTable order={current} />

      <OrderActions
        order={current}
        capabilities={capabilities}
        cancelling={cancelling}
        onCancel={onCancel}
        onPrint={() => window.print()}
      />
    </section>
  );
}
