import { useState } from 'react';
import type { RefObject } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Money } from '../../../components/Money';
import { ErrorBanner } from '../../../components/ErrorBanner';
import { listProducts } from '../../../lib/api/endpoints';
import { useAsync } from '../../../lib/useAsync';
import { useCart } from '../../cart/CartProvider';
import { lineTotal } from '../../cart/cartLogic';
import { SaveTemplateDialog } from '../../checkout-templates/SaveTemplateDialog';
import { TemplatePicker } from '../../checkout-templates/TemplatePicker';
import type { CheckoutTemplate } from '../../checkout-templates/db/templateTypes';

interface ReviewCartStepProps {
  headingRef: RefObject<HTMLHeadingElement>;
}

export function ReviewCartStep({ headingRef }: ReviewCartStepProps) {
  const cart = useCart();
  const products = useAsync(() => listProducts(), []);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [loadMessage, setLoadMessage] = useState<string | null>(null);

  function applyTemplate(template: CheckoutTemplate) {
    // Each template line is matched against the live catalog and merged into the current cart
    // through the same `add`/`setQuantity` calls the catalog page already uses; a product that
    // no longer exists is skipped rather than failing the whole load.
    const catalog = products.data ?? [];
    let skipped = 0;
    for (const templateLine of template.lines) {
      const product = catalog.find((p) => p.id === templateLine.product_id);
      if (!product) {
        skipped += 1;
        continue;
      }
      const alreadyInCart = cart.lines.some((l) => l.product_id === product.id);
      if (alreadyInCart) {
        cart.setQuantity(product.id, templateLine.quantity_kg);
      } else {
        cart.add(product, templateLine.quantity_kg);
      }
    }
    setShowPicker(false);
    setLoadMessage(
      skipped > 0
        ? `Loaded "${template.name}". ${skipped} product${skipped === 1 ? '' : 's'} from the template are no longer in the catalog and were skipped.`
        : `Loaded "${template.name}" into your cart.`,
    );
  }

  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1}>
        Review your cart
      </h2>
      <div className="actions checkout-template-actions">
        <Button variant="secondary" onClick={() => setShowSaveDialog(true)} disabled={cart.lines.length === 0}>
          Save as template
        </Button>
        <Button variant="secondary" onClick={() => setShowPicker(true)}>
          Load a saved template
        </Button>
      </div>

      {loadMessage && (
        <div className="banner banner-info" role="status">
          <p>{loadMessage}</p>
        </div>
      )}
      {products.error && <ErrorBanner error={products.error} onRetry={products.reload} />}

      {cart.lines.length === 0 ? (
        <EmptyState title="Your cart is empty">
          <Link to="/catalog">Browse the catalog</Link> to add carrots, or load a saved template above.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Price</th>
                <th className="num">Quantity (kg)</th>
                <th className="num">Preview total</th>
              </tr>
            </thead>
            <tbody>
              {cart.lines.map((line) => (
                <tr key={line.product_id}>
                  <td>
                    <strong>{line.name}</strong>
                    <div className="muted small">{line.sku}</div>
                  </td>
                  <td className="num">
                    <Money value={line.unit_price} /> / kg
                  </td>
                  <td className="num">{line.quantity_kg.toLocaleString('en-US')} kg</td>
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
                  <Money value={cart.total} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showSaveDialog && (
        <SaveTemplateDialog lines={cart.lines} onClose={() => setShowSaveDialog(false)} />
      )}
      {showPicker && (
        <TemplatePicker onUseTemplate={applyTemplate} onClose={() => setShowPicker(false)} />
      )}
    </div>
  );
}
