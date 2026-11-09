import type { Money } from './api/types';

// Display only. All arithmetic below stays in integer minor units.
export function formatMoney(value: Money): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: value.currency,
  });
  return formatter.format(value.amount_minor / 100);
}

export function multiply(unit: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) {
    throw new RangeError('quantity must be a whole number');
  }
  return { amount_minor: unit.amount_minor * quantity, currency: unit.currency };
}

export function sum(values: Money[], currency = 'USD'): Money {
  let total = 0;
  for (const value of values) {
    if (value.currency !== currency) {
      throw new RangeError(`cannot add ${value.currency} to ${currency}`);
    }
    total += value.amount_minor;
  }
  return { amount_minor: total, currency };
}
