import type { Order, OrderStatus } from '../../lib/api/types';

export type StatusFilter = OrderStatus | 'all';

export interface OrdersFilter {
  status: StatusFilter;
  number: string;
}

export const NO_FILTER: OrdersFilter = { status: 'all', number: '' };

export function isFilterActive(filter: OrdersFilter): boolean {
  return filter.status !== 'all' || filter.number.trim() !== '';
}

export function filterOrders(orders: Order[], filter: OrdersFilter): Order[] {
  const needle = filter.number.trim().toLowerCase();
  return orders.filter(
    (o) =>
      (filter.status === 'all' || o.status === filter.status) &&
      (needle === '' || o.number.toLowerCase().includes(needle)),
  );
}
