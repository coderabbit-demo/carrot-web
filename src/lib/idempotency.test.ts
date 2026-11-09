import { describe, expect, it } from 'vitest';
import { createCheckoutKey } from './idempotency';

function counter() {
  let n = 0;
  return () => `key-${++n}-0123456789abcdef`;
}

describe('createCheckoutKey', () => {
  it('returns the same key for retries and double clicks of the same cart', () => {
    const holder = createCheckoutKey(counter());
    const first = holder.get('a:1');
    expect(holder.get('a:1')).toBe(first);
    expect(holder.get('a:1')).toBe(first);
  });

  it('issues a new key when the cart changes', () => {
    const holder = createCheckoutKey(counter());
    const first = holder.get('a:1');
    const second = holder.get('a:2');
    expect(second).not.toBe(first);
    expect(holder.get('a:2')).toBe(second);
  });

  it('issues a new key after reset, even for the same cart', () => {
    const holder = createCheckoutKey(counter());
    const first = holder.get('a:1');
    holder.reset();
    expect(holder.get('a:1')).not.toBe(first);
  });

  it('generates keys the gateway accepts by default', () => {
    const key = createCheckoutKey().get('a:1');
    expect(key).toMatch(/^[A-Za-z0-9_.:-]{16,128}$/);
  });
});
