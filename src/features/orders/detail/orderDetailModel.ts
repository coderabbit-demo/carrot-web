import type { Order, OrderStatus } from '../../../lib/api/types';
import type { PollerState } from './paymentPoller';
import { totalPollWindowMs } from './pollSchedule';

export type BannerTone = 'warning' | 'error' | 'info';
export type BannerKind = 'confirming' | 'failed' | 'review' | 'cancelled';

export interface StatusBannerModel {
  kind: BannerKind;
  tone: BannerTone;
  message: string;
}

const BANNERS: Partial<Record<OrderStatus, StatusBannerModel>> = {
  payment_pending: {
    kind: 'confirming',
    tone: 'warning',
    message: "We're confirming your payment. Your order is saved and the stock is held for you.",
  },
  payment_failed: {
    kind: 'failed',
    tone: 'error',
    message: 'Payment was declined for this order. No charge was made.',
  },
  review_required: {
    kind: 'review',
    tone: 'warning',
    message:
      'Your payment was received but we could not complete the order automatically. Our team will review it.',
  },
  cancelled: {
    kind: 'cancelled',
    tone: 'info',
    message: 'This order was cancelled.',
  },
};

/** The banner to show for a status, or null for statuses that need no explanation. */
export function statusBanner(status: OrderStatus): StatusBannerModel | null {
  return Object.prototype.hasOwnProperty.call(BANNERS, status) ? (BANNERS[status] ?? null) : null;
}

/** What the automatic re-checking is doing, in words. Null when there is nothing to say. */
export function pollingNote(state: PollerState): string | null {
  switch (state) {
    case 'waiting':
      return 'Checking again automatically. This page updates when the payment resolves.';
    case 'paused':
      return 'Automatic checks are paused while this tab is in the background.';
    case 'exhausted': {
      const minutes = Math.max(1, Math.round(totalPollWindowMs() / 60000));
      return `We checked automatically for about ${minutes} minutes and then stopped. Use the button to check again.`;
    }
    default:
      return null;
  }
}

/** Shown after a manual check that came back with the payment still undecided. */
export function checkResultNote(status: OrderStatus): string | null {
  return status === 'payment_pending'
    ? 'The payment is still being confirmed. Please check again in a moment.'
    : null;
}

export interface OrderTotals {
  lineCount: number;
  totalKg: number;
}

export function orderTotals(order: Pick<Order, 'lines'>): OrderTotals {
  let totalKg = 0;
  for (const line of order.lines) totalKg += line.quantity_kg;
  return { lineCount: order.lines.length, totalKg };
}

/** "3 products, 120 kg" style summary shown under the lines table. */
export function linesSummary(totals: OrderTotals, formatKg: (kg: number) => string): string {
  const noun = totals.lineCount === 1 ? 'product' : 'products';
  return `${totals.lineCount} ${noun} · ${formatKg(totals.totalKg)}`;
}

/** Invoice numbers mirror order numbers: ORD-100001 is invoiced as INV-100001. */
export function invoiceNumberFor(orderNumber: string): string {
  return `INV-${orderNumber.replace(/\D/g, '')}`;
}
