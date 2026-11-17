import type { RefObject } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { Money } from '../../../components/Money';
import { formatKg } from '../../../lib/format';
import type { StockShortage } from '../../../lib/api/types';
import type { CartLine } from '../../cart/cartLogic';
import { lineTotal, cartTotal } from '../../cart/cartLogic';
import type { CheckoutFailure } from '../../cart/checkoutError';

interface ConfirmReviewStepProps {
  headingRef: RefObject<HTMLHeadingElement>;
  lines: CartLine[];
  delivery: { notes: string; purchaseOrderReference: string };
  submitting: boolean;
  failure: CheckoutFailure | null;
  onPlaceOrder(): void;
  onAdjustQuantities(items: StockShortage[]): void;
}

export function ConfirmReviewStep({
  headingRef,
  lines,
  delivery,
  submitting,
  failure,
  onPlaceOrder,
  onAdjustQuantities,
}: ConfirmReviewStepProps) {
  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1}>
        Confirm your order
      </h2>
      <p className="muted small">
        Prices and the final total shown below are a preview. The server confirms the actual unit
        prices, totals, and stock availability when the order is placed.
      </p>

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
                  const name = lines.find((l) => l.product_id === item.product_id)?.name ?? item.product_id;
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
          </div>
          {failure.kind === 'insufficient_stock' && (
            <Button variant="secondary" onClick={() => onAdjustQuantities(failure.items)}>
              Adjust quantities
            </Button>
          )}
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">Quantity (kg)</th>
              <th className="num">Unit price</th>
              <th className="num">Preview total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.product_id}>
                <td>{line.name}</td>
                <td className="num">{formatKg(line.quantity_kg)}</td>
                <td className="num">
                  <Money value={line.unit_price} />
                </td>
                <td className="num">
                  <Money value={lineTotal(line)} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Estimated total</td>
              <td className="num">
                <Money value={cartTotal(lines)} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {(delivery.notes || delivery.purchaseOrderReference) && (
        <dl className="details checkout-delivery-summary">
          {delivery.purchaseOrderReference && (
            <>
              <dt>Purchase order reference</dt>
              <dd>{delivery.purchaseOrderReference}</dd>
            </>
          )}
          {delivery.notes && (
            <>
              <dt>Delivery notes</dt>
              <dd>{delivery.notes}</dd>
            </>
          )}
        </dl>
      )}

      <div className="actions">
        <Button loading={submitting} disabled={lines.length === 0} onClick={onPlaceOrder}>
          {submitting ? 'Placing order…' : 'Place order'}
        </Button>
      </div>
    </div>
  );
}
