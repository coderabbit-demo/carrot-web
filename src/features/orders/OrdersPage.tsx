import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorBanner } from '../../components/ErrorBanner';
import { Money } from '../../components/Money';
import { Spinner } from '../../components/Spinner';
import { STATUS_LABELS, StatusBadge } from '../../components/StatusBadge';
import { listOrders } from '../../lib/api/endpoints';
import { formatDateTime } from '../../lib/format';
import { useAsync } from '../../lib/useAsync';
import { NO_FILTER, filterOrders, isFilterActive } from './ordersFilter';
import type { OrdersFilter, StatusFilter } from './ordersFilter';

const STATUS_OPTIONS = Object.keys(STATUS_LABELS) as Exclude<StatusFilter, 'all'>[];

export function OrdersPage() {
  const orders = useAsync(() => listOrders(), []);
  const [filter, setFilter] = useState<OrdersFilter>(NO_FILTER);
  const visible = orders.data ? filterOrders(orders.data, filter) : [];
  const filtering = isFilterActive(filter);

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
        <div className="filters">
          <label className="field">
            <span>Status</span>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value as StatusFilter })}
            >
              <option value="all">All</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Order number</span>
            <input
              type="search"
              placeholder="e.g. CC-100201"
              value={filter.number}
              onChange={(e) => setFilter({ ...filter, number: e.target.value })}
            />
          </label>
        </div>
      )}
      {orders.data && orders.data.length > 0 && filtering && (
        <p className="muted small" role="status">
          Showing {visible.length} of {orders.data.length} orders
        </p>
      )}
      {orders.data && orders.data.length > 0 && visible.length === 0 && (
        <EmptyState title="No orders match your filters">
          <Button variant="secondary" onClick={() => setFilter(NO_FILTER)}>
            Clear filters
          </Button>
        </EmptyState>
      )}
      {orders.data && visible.length > 0 && (
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
              {visible.map((order) => (
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
