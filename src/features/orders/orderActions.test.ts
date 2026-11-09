import { describe, expect, it } from 'vitest';
import type { OrderStatus } from '../../lib/api/types';
import { orderActions } from './orderActions';

describe('orderActions', () => {
  it('lets only admins cancel, and only pending orders', () => {
    expect(orderActions('pending', 'admin').canCancel).toBe(true);
    expect(orderActions('pending', 'buyer').canCancel).toBe(false);

    const others: OrderStatus[] = [
      'payment_pending',
      'confirmed',
      'payment_failed',
      'cancelled',
      'review_required',
    ];
    for (const status of others) {
      expect(orderActions(status, 'admin').canCancel).toBe(false);
    }
  });

  it('offers a payment check only while payment_pending', () => {
    expect(orderActions('payment_pending', 'admin')).toMatchObject({
      canCheckPayment: true,
      checkPaymentMode: 'reconcile',
    });
    expect(orderActions('payment_pending', 'buyer')).toMatchObject({
      canCheckPayment: true,
      checkPaymentMode: 'refresh',
    });
    expect(orderActions('confirmed', 'admin')).toMatchObject({
      canCheckPayment: false,
      checkPaymentMode: null,
    });
  });
});
