import { formatKg } from '../../lib/format';

/**
 * Early check for an add-to-cart against the stock the catalog last reported.
 * The server still decides at checkout; this only gives a clearer message sooner.
 */
export function checkCartAvailability(
  availableKg: number,
  inCartKg: number,
  requestedKg: number,
): string | null {
  if (inCartKg + requestedKg <= availableKg) return null;
  if (inCartKg <= 0) return `Only ${formatKg(availableKg)} available.`;
  if (inCartKg > availableKg) {
    return `You already have ${formatKg(inCartKg)} in your cart, but only ${formatKg(availableKg)} is available now.`;
  }
  const headroom = availableKg - inCartKg;
  if (headroom === 0) {
    return `Your cart already holds all ${formatKg(availableKg)} available.`;
  }
  return `Only ${formatKg(headroom)} more available; you already have ${formatKg(inCartKg)} in your cart.`;
}
