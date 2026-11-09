import type { OrderStatus } from '../lib/api/types';

const LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  payment_pending: 'Confirming payment',
  confirmed: 'Confirmed',
  payment_failed: 'Payment failed',
  cancelled: 'Cancelled',
  review_required: 'Under review',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] ?? status}</span>;
}
