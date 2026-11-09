import { describe, expect, it } from 'vitest';
import { formatMoney, multiply, sum } from './money';

const usd = (amount_minor: number) => ({ amount_minor, currency: 'USD' });

describe('formatMoney', () => {
  it('formats minor units as dollars', () => {
    expect(formatMoney(usd(175))).toBe('$1.75');
    expect(formatMoney(usd(35000))).toBe('$350.00');
    expect(formatMoney(usd(5))).toBe('$0.05');
    expect(formatMoney(usd(0))).toBe('$0.00');
    expect(formatMoney(usd(123456789))).toBe('$1,234,567.89');
  });
});

describe('multiply', () => {
  it('multiplies a unit price by whole kilograms', () => {
    expect(multiply(usd(175), 120)).toEqual(usd(21000));
  });

  it('rejects fractional quantities', () => {
    expect(() => multiply(usd(175), 1.5)).toThrow(RangeError);
  });
});

describe('sum', () => {
  it('adds integers without rounding drift', () => {
    expect(sum([usd(10), usd(20), usd(30)])).toEqual(usd(60));
  });

  it('is zero for an empty list', () => {
    expect(sum([])).toEqual(usd(0));
  });

  it('refuses mixed currencies', () => {
    expect(() => sum([usd(1), { amount_minor: 1, currency: 'EUR' }])).toThrow(RangeError);
  });
});
