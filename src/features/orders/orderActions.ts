import type { OrderStatus, Role } from '../../lib/api/types';

export interface OrderActions {
  /** Only admins, and only while no payment has been requested. */
  canCancel: boolean;
  /** Offered while the payment outcome is unknown. */
  canCheckPayment: boolean;
  /** Admins ask the server to reconcile with billing; buyers just reload the order. */
  checkPaymentMode: 'reconcile' | 'refresh' | null;
}

export function orderActions(status: OrderStatus, role: Role): OrderActions {
  const awaitingPayment = status === 'payment_pending';
  return {
    canCancel: role === 'admin' && status === 'pending',
    canCheckPayment: awaitingPayment,
    checkPaymentMode: awaitingPayment ? (role === 'admin' ? 'reconcile' : 'refresh') : null,
  };
}
