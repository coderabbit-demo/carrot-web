import type { Invoice, Membership, Money, Order, OrderStatus } from '../../lib/api/types';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'payment_pending',
  'confirmed',
  'payment_failed',
  'review_required',
  'cancelled',
];

/** Orders in these states are waiting on someone: the buyer, billing or the support team. */
export const ATTENTION_STATUSES: readonly OrderStatus[] = [
  'payment_pending',
  'review_required',
  'payment_failed',
];

export type StatusCounts = Record<OrderStatus, number>;

export function countOrdersByStatus(orders: readonly Order[]): StatusCounts {
  const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as StatusCounts;
  for (const order of orders) {
    if (order.status in counts) counts[order.status] += 1;
  }
  return counts;
}

function createdMs(order: Order): number {
  const ms = Date.parse(order.created_at);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

/** Orders that need follow-up, newest first. Unreadable dates sort last; ties keep a stable order. */
export function attentionOrders(orders: readonly Order[]): Order[] {
  return orders
    .filter((order) => ATTENTION_STATUSES.includes(order.status))
    .sort((a, b) => {
      const ma = createdMs(a);
      const mb = createdMs(b);
      if (ma !== mb) return ma < mb ? 1 : -1;
      return b.number.localeCompare(a.number, 'en', { numeric: true }) || a.id.localeCompare(b.id);
    });
}

export function attentionHint(status: OrderStatus): string {
  switch (status) {
    case 'payment_pending':
      return 'Waiting for the payment to be confirmed.';
    case 'payment_failed':
      return 'The payment was declined. No charge was made.';
    case 'review_required':
      return 'Paid, but the order needs a manual review.';
    default:
      return '';
  }
}

function addSafely(a: number, b: number): number {
  const sum = a + b;
  if (!Number.isSafeInteger(sum)) throw new RangeError('total exceeds the safe integer range');
  return sum;
}

/** Sums integer minor units per currency, so different currencies are never added together. */
export function totalsByCurrency(values: readonly Money[]): Money[] {
  const totals = new Map<string, number>();
  for (const value of values) {
    totals.set(value.currency, addSafely(totals.get(value.currency) ?? 0, value.amount_minor));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount_minor]) => ({ amount_minor, currency }));
}

/**
 * Integer division that rounds half up, done with the remainder instead of a float quotient so
 * large totals cannot be nudged across a rounding boundary.
 */
export function divideRoundHalfUp(total: number, count: number): number {
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError('expected a safe integer total and a positive count');
  }
  const remainder = total % count;
  const quotient = (total - remainder) / count;
  return remainder * 2 >= count ? quotient + 1 : quotient;
}

export interface AverageValue {
  currency: string;
  orderCount: number;
  average: Money;
}

/** Average order value over confirmed orders, per currency. Orders that were not paid are left out. */
export function averageOrderValues(orders: readonly Order[]): AverageValue[] {
  const confirmed = orders.filter((order) => order.status === 'confirmed');
  const byCurrency = new Map<string, Order[]>();
  for (const order of confirmed) {
    const group = byCurrency.get(order.total.currency);
    if (group) group.push(order);
    else byCurrency.set(order.total.currency, [order]);
  }
  return [...byCurrency.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, group]) => {
      const [total] = totalsByCurrency(group.map((order) => order.total));
      return {
        currency,
        orderCount: group.length,
        average: { amount_minor: divideRoundHalfUp(total.amount_minor, group.length), currency },
      };
    });
}

export interface OrderSummary {
  orderCount: number;
  statusCounts: StatusCounts;
  attention: Order[];
  averages: AverageValue[];
}

export function summarizeOrders(orders: readonly Order[]): OrderSummary {
  return {
    orderCount: orders.length,
    statusCounts: countOrdersByStatus(orders),
    attention: attentionOrders(orders),
    averages: averageOrderValues(orders),
  };
}

export interface InvoiceSummary {
  invoiceCount: number;
  billed: Money[];
}

export function summarizeInvoices(invoices: readonly Invoice[]): InvoiceSummary {
  return {
    invoiceCount: invoices.length,
    billed: totalsByCurrency(invoices.map((invoice) => invoice.total)),
  };
}

export interface MembershipSummary {
  total: number;
  adminCount: number;
  buyerCount: number;
  current: Membership | null;
  others: Membership[];
}

export function summarizeMemberships(
  memberships: readonly Membership[],
  currentOrganizationId: string | null,
): MembershipSummary {
  const current = memberships.find((m) => m.organization_id === currentOrganizationId) ?? null;
  const others = memberships
    .filter((m) => m !== current)
    .sort((a, b) => a.organization_name.localeCompare(b.organization_name));
  return {
    total: memberships.length,
    adminCount: memberships.filter((m) => m.role === 'admin').length,
    buyerCount: memberships.filter((m) => m.role === 'buyer').length,
    current,
    others,
  };
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

/**
 * Says how much of the history a list covers. The API returns at most `limit` records, so a list
 * that reaches the limit is described as partial rather than complete.
 */
export function coverageNote(noun: string, count: number, limit: number): string {
  if (count === 0) return `No ${noun}s were returned.`;
  if (count >= limit) {
    return `Covers the ${count} most recent ${noun}s. Older ${noun}s are not included.`;
  }
  return `Covers all ${count} ${plural(count, noun)} returned.`;
}
