import { Link } from 'react-router-dom';
import { Money } from '../../components/Money';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime } from '../../lib/format';
import type { Order } from '../../lib/api/types';
import { attentionHint } from './overviewStats';

interface Props {
  orders: Order[];
  /** How many to list before pointing at the full orders page. */
  visible?: number;
}

export function AttentionList({ orders, visible = 10 }: Props) {
  if (orders.length === 0) {
    return (
      <p className="overview-clear" role="status">
        Nothing needs attention. No recent order is waiting on a payment or a review.
      </p>
    );
  }

  const shown = orders.slice(0, visible);
  const hidden = orders.length - shown.length;

  return (
    <>
      <p className="muted small">
        {orders.length} {orders.length === 1 ? 'order needs' : 'orders need'} attention, newest first.
      </p>
      <ul className="attention-list">
        {shown.map((order) => (
          <li key={order.id} className="attention-item">
            <div className="attention-main">
              <Link to={`/orders/${encodeURIComponent(order.id)}`}>Order {order.number}</Link>
              <StatusBadge status={order.status} />
            </div>
            <p className="attention-hint">{attentionHint(order.status)}</p>
            <p className="muted small attention-meta">
              Placed {formatDateTime(order.created_at)} · <Money value={order.total} />
            </p>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <p className="small">
          and {hidden} more. <Link to="/orders">See all orders</Link>
        </p>
      )}
    </>
  );
}
