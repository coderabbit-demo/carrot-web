import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Money } from '../../components/Money';
import { formatKg } from '../../lib/format';
import type { Product } from '../../lib/api/types';
import { useCart } from '../cart/CartProvider';
import { parseQuantityInput } from '../cart/cartLogic';
import { AVAILABILITY_LABELS, availabilityOf } from './availability';
import { checkCartAvailability } from './cartAvailability';

export function ProductCard({ product }: { product: Product }) {
  const cart = useCart();
  const [draft, setDraft] = useState('10');
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const availability = availabilityOf(product.available_kg);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setAdded(false);
    const parsed = parseQuantityInput(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const inCartKg = cart.lines.find((l) => l.product_id === product.id)?.quantity_kg ?? 0;
    const stockError = checkCartAvailability(product.available_kg, inCartKg, parsed.value);
    if (stockError) {
      setError(stockError);
      return;
    }
    const cartError = cart.add(product, parsed.value);
    setError(cartError);
    setAdded(cartError === null);
  }

  return (
    <article className="card product-card">
      <header>
        <h2>{product.name}</h2>
        <span className={`avail avail-${availability}`}>{AVAILABILITY_LABELS[availability]}</span>
      </header>
      <p className="muted">{product.description}</p>
      <p className="price">
        <Money value={product.unit_price} /> <span className="muted">per kg</span>
      </p>
      <p className="small muted">
        {availability === 'out_of_stock' ? 'None available' : `${formatKg(product.available_kg)} available`}
      </p>

      <form onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>Quantity (kg)</span>
          <input
            className="qty-input"
            inputMode="numeric"
            value={draft}
            disabled={availability === 'out_of_stock'}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
              setAdded(false);
            }}
          />
          {error && <span className="field-error">{error}</span>}
        </label>
        <Button type="submit" disabled={availability === 'out_of_stock'}>
          Add to cart
        </Button>
        {added && (
          <span className="added" role="status">
            Added
          </span>
        )}
      </form>
    </article>
  );
}
