import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Money } from '../../components/Money';
import { asApiError } from '../../lib/api/client';
import { createOrder } from '../../lib/api/endpoints';
import { createCheckoutKey } from '../../lib/idempotency';
import { formatKg } from '../../lib/format';
import { cartSignature, lineTotal, MAX_QUANTITY_KG, parseQuantityInput } from './cartLogic';
import type { CartLine } from './cartLogic';
import { describeCheckoutError } from './checkoutError';
import type { CheckoutFailure } from './checkoutError';
import { useCart } from './CartProvider';

function CartLineRow({ line, disabled }: { line: CartLine; disabled: boolean }) {
  const cart = useCart();
  const [draft, setDraft] = useState(String(line.quantity_kg));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(String(line.quantity_kg));
    setError(null);
  }, [line.quantity_kg]);

  function onChange(raw: string) {
    setDraft(raw);
    const parsed = parseQuantityInput(raw);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    cart.setQuantity(line.product_id, parsed.value);
  }

  return (
    <tr>
      <td>
        <strong>{line.name}</strong>
        <div className="muted small">{line.sku}</div>
      </td>
      <td className="num">
        <Money value={line.unit_price} /> / kg
      </td>
      <td className="num">
        <input
          className="qty-input"
          inputMode="numeric"
          aria-label={`Quantity in kg for ${line.name}`}
          value={draft}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {error && <div className="field-error">{error}</div>}
      </td>
      <td className="num">
        <Money value={lineTotal(line)} />
      </td>
      <td className="num">
        <Button variant="secondary" disabled={disabled} onClick={() => cart.remove(line.product_id)}>
          Remove
        </Button>
      </td>
    </tr>
  );
}

export function CartPage() {
  const cart = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<CheckoutFailure | null>(null);

  const checkoutKey = useRef(createCheckoutKey());
  // The state flag disables the button after the next render; the ref also blocks a second
  // click that lands before that render.
  const inFlight = useRef(false);

  async function placeOrder() {
    if (inFlight.current || cart.lines.length === 0) return;
    inFlight.current = true;
    setSubmitting(true);
    setFailure(null);

    const key = checkoutKey.current.get(cartSignature(cart.lines));
    try {
      // 201/200 give a final order; 202 gives an order still in payment_pending because the
      // payment provider has not answered yet. All are accepted orders: the detail page
      // shows the server status and total, and the cart is cleared.
      const order = await createOrder(
        { lines: cart.lines.map((l) => ({ product_id: l.product_id, quantity_kg: l.quantity_kg })) },
        key,
      );
      checkoutKey.current.reset();
      cart.clear();
      navigate(`/orders/${order.id}`);
    } catch (e) {
      const described = describeCheckoutError(asApiError(e));
      if (described.terminal) checkoutKey.current.reset();
      setFailure(described);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (cart.lines.length === 0 && !failure) {
    return (
      <section>
        <h1>Your cart</h1>
        <EmptyState title="Your cart is empty">
          <Link to="/catalog">Browse the catalog</Link> to add carrots.
        </EmptyState>
      </section>
    );
  }

  return (
    <section>
      <h1>Your cart</h1>

      {failure && (
        <div
          className={`banner ${failure.kind === 'retry' ? 'banner-warning' : 'banner-error'}`}
          role="alert"
        >
          <div>
            <p>{failure.message}</p>
            {failure.kind === 'insufficient_stock' && (
              <ul>
                {failure.items.map((item) => {
                  const name =
                    cart.lines.find((l) => l.product_id === item.product_id)?.name ?? item.product_id;
                  return (
                    <li key={item.product_id}>
                      {name}: you asked for {formatKg(item.requested_kg)}, {formatKg(item.available_kg)}{' '}
                      available
                    </li>
                  );
                })}
              </ul>
            )}
            {failure.kind === 'declined' && failure.orderId && (
              <p>
                <Link to={`/orders/${failure.orderId}`}>View the declined order</Link>
              </p>
            )}
            {failure.kind === 'unauthenticated' && <p>Your cart is saved.</p>}
          </div>
          {failure.kind === 'insufficient_stock' && (
            <Button
              variant="secondary"
              onClick={() => {
                cart.adjustToAvailability(failure.items);
                setFailure(null);
              }}
            >
              Adjust quantities
            </Button>
          )}
        </div>
      )}

      {cart.lines.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num">Price</th>
                  <th className="num">Quantity (kg)</th>
                  <th className="num">Preview total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.lines.map((line) => (
                  <CartLineRow key={line.product_id} line={line} disabled={submitting} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Estimated total</td>
                  <td className="num">
                    <Money value={cart.total} />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="muted small">
            Whole kilograms, 1 to {MAX_QUANTITY_KG.toLocaleString('en-US')} per product. Prices and
            the final total are confirmed by the server when you place the order.
          </p>

          <div className="actions">
            <Button loading={submitting} onClick={placeOrder}>
              {submitting ? 'Placing order…' : 'Place order'}
            </Button>
            <Button variant="secondary" disabled={submitting} onClick={() => cart.clear()}>
              Clear cart
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
