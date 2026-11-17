import { useState } from 'react';
import type { RefObject } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/Button';
import { Money } from '../../../components/Money';
import { StatusBadge } from '../../../components/StatusBadge';
import type { Order } from '../../../lib/api/types';
import { SaveTemplateDialog } from '../../checkout-templates/SaveTemplateDialog';
import type { CartLine } from '../../cart/cartLogic';

interface SuccessStepProps {
  headingRef: RefObject<HTMLHeadingElement>;
  order: Order;
}

function orderLinesToCartLines(order: Order): CartLine[] {
  return order.lines.map((line) => ({
    product_id: line.product_id,
    sku: line.sku,
    name: line.name,
    unit_price: line.unit_price,
    quantity_kg: line.quantity_kg,
  }));
}

export function SuccessStep({ headingRef, order }: SuccessStepProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1}>
        Order placed
      </h2>
      <p>
        Order <strong>{order.number}</strong> was placed. Status: <StatusBadge status={order.status} />
      </p>
      <p>
        Confirmed total: <Money value={order.total} />
      </p>
      <p>
        <Link to={`/orders/${order.id}`}>View order details</Link>
      </p>

      <div className="actions">
        <Button variant="secondary" onClick={() => setShowSaveDialog(true)}>
          Save this as a template for next time
        </Button>
        <Link to="/catalog" className="btn btn-secondary">
          Back to catalog
        </Link>
      </div>

      {showSaveDialog && (
        <SaveTemplateDialog
          lines={orderLinesToCartLines(order)}
          onClose={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
}
