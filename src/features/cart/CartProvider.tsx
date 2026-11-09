import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Money, Product, StockShortage } from '../../lib/api/types';
import {
  addLine,
  adjustToAvailability,
  cartTotal,
  parseStoredCart,
  removeLine,
  setLineQuantity,
  validateQuantity,
} from './cartLogic';
import type { CartLine } from './cartLogic';

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  total: Money;
  /** Each mutator returns an error message, or null on success. */
  add(product: Product, quantityKg: number): string | null;
  setQuantity(productId: string, quantityKg: number): string | null;
  remove(productId: string): void;
  clear(): void;
  adjustToAvailability(shortages: StockShortage[]): void;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(organizationId: string): string {
  return `carrot.cart.${organizationId}`;
}

function loadCart(organizationId: string | null): CartLine[] {
  if (!organizationId) return [];
  try {
    return parseStoredCart(localStorage.getItem(storageKey(organizationId)));
  } catch {
    return [];
  }
}

// Mount with key={organizationId} so each organization gets its own cart state.
// Only cart lines are stored, never session data.
export function CartProvider({
  organizationId,
  children,
}: {
  organizationId: string | null;
  children: ReactNode;
}) {
  const [lines, setLines] = useState<CartLine[]>(() => loadCart(organizationId));

  useEffect(() => {
    if (!organizationId) return;
    try {
      localStorage.setItem(storageKey(organizationId), JSON.stringify(lines));
    } catch {
      // Storage full or blocked: the cart still works for this page load.
    }
  }, [organizationId, lines]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      itemCount: lines.length,
      total: cartTotal(lines),
      add(product, quantityKg) {
        const result = addLine(lines, {
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          unit_price: product.unit_price,
          quantity_kg: quantityKg,
        });
        if (!result.error) setLines(result.lines);
        return result.error;
      },
      setQuantity(productId, quantityKg) {
        const error = validateQuantity(quantityKg);
        if (!error) setLines(setLineQuantity(lines, productId, quantityKg));
        return error;
      },
      remove(productId) {
        setLines(removeLine(lines, productId));
      },
      clear() {
        setLines([]);
      },
      adjustToAvailability(shortages) {
        setLines(adjustToAvailability(lines, shortages));
      },
    }),
    [lines],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
