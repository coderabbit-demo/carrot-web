import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Money } from '../../components/Money';
import { Spinner } from '../../components/Spinner';
import { StatusBadge } from '../../components/StatusBadge';
import { listOrders } from '../../lib/api/endpoints';
import { formatDateTime } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';

export function OrdersPage() {
  const orders = useAsync(() => listOrders(), []);

  return (
    <section>
      <h1>Orders</h1>

      {orders.error && !orders.data && <ErrorBanner error={orders.error} onRetry={orders.reload} />}
      {orders.loading && !orders.data && <Spinner label="Loading orders…" />}
      {orders.data && orders.data.length === 0 && (
        <EmptyState title="No orders yet">
          <Link to="/catalog">Browse the catalog</Link> to place your first order.
        </EmptyState>
      )}
      {orders.data && orders.data.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Placed</th>
                <th>Status</th>
                <th className="num">Items</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link to={`/orders/${order.id}`}>{order.number}</Link>
                  </td>
                  <td>{formatDateTime(order.created_at)}</td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="num">{order.lines.length}</td>
                  <td className="num">
                    <Money value={order.total} />
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
