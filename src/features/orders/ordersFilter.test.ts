import { describe, expect, it } from 'vitest';
import type { Order, OrderStatus } from '../../lib/api/types';
import { NO_FILTER, filterOrders, isFilterActive } from './ordersFilter';

function order(number: string, status: OrderStatus): Order {
  return {
    id: `id-${number}`,
    number,
    status,
    lines: [],
    total: { amount_minor: 1000, currency: 'USD' },
    invoice_id: null,
    failure_code: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

const orders = [
  order('CC-100201', 'confirmed'),
  order('CC-100202', 'pending'),
  order('CC-100310', 'confirmed'),
  order('CC-100311', 'cancelled'),
];

const numbers = (list: Order[]) => list.map((o) => o.number);

describe('filterOrders', () => {
  it('returns every order when no filter is set', () => {
    expect(filterOrders(orders, NO_FILTER)).toEqual(orders);
  });

  it('filters by status', () => {
    expect(numbers(filterOrders(orders, { status: 'confirmed', number: '' }))).toEqual([
      'CC-100201',
      'CC-100310',
    ]);
  });

  it('matches the order number as a case-insensitive substring', () => {
    expect(numbers(filterOrders(orders, { status: 'all', number: 'cc-100201' }))).toEqual(['CC-100201']);
    expect(numbers(filterOrders(orders, { status: 'all', number: '1003' }))).toEqual([
      'CC-100310',
      'CC-100311',
    ]);
  });

  it('ignores surrounding whitespace in the number', () => {
    expect(numbers(filterOrders(orders, { status: 'all', number: '  100202 ' }))).toEqual(['CC-100202']);
  });

  it('combines status and number', () => {
    expect(numbers(filterOrders(orders, { status: 'confirmed', number: '1003' }))).toEqual(['CC-100310']);
    expect(filterOrders(orders, { status: 'pending', number: '1003' })).toEqual([]);
  });
});

describe('isFilterActive', () => {
  it('is false for the default and whitespace-only number', () => {
    expect(isFilterActive(NO_FILTER)).toBe(false);
    expect(isFilterActive({ status: 'all', number: '   ' })).toBe(false);
  });

  it('is true when a status or number is set', () => {
    expect(isFilterActive({ status: 'cancelled', number: '' })).toBe(true);
    expect(isFilterActive({ status: 'all', number: '10' })).toBe(true);
  });
});
