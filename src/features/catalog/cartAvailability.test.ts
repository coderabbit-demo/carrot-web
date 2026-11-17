import { describe, expect, it } from 'vitest';
import { checkCartAvailability } from './cartAvailability';

describe('checkCartAvailability', () => {
  it('compares against stock alone when the cart has no line for the product', () => {
    expect(checkCartAvailability(100, 0, 100)).toBeNull();
    expect(checkCartAvailability(100, 0, 101)).toBe('Only 100 kg available.');
  });

  it('names the kilograms still addable when there is partial headroom', () => {
    expect(checkCartAvailability(100, 80, 30)).toBe(
      'Only 20 kg more available; you already have 80 kg in your cart.',
    );
  });

  it('accepts an add that lands exactly on the available quantity', () => {
    expect(checkCartAvailability(100, 80, 20)).toBeNull();
  });

  it('says so when the cart already holds all available stock', () => {
    expect(checkCartAvailability(100, 100, 1)).toBe('Your cart already holds all 100 kg available.');
  });

  it('handles stock that dropped below what the cart holds', () => {
    const message = checkCartAvailability(60, 80, 1);
    expect(message).toBe('You already have 80 kg in your cart, but only 60 kg is available now.');
  });

  it('accepts small adds when there is plenty of headroom', () => {
    expect(checkCartAvailability(100, 10, 5)).toBeNull();
  });
});
