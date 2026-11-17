import type { RefObject } from 'react';
import { MAX_NOTES_LENGTH, MAX_PO_REFERENCE_LENGTH } from '../checkoutWizard.types';
import type { DeliveryDetails, DeliveryDetailsErrors } from '../checkoutWizard.types';

interface DeliveryDetailsStepProps {
  headingRef: RefObject<HTMLHeadingElement>;
  delivery: DeliveryDetails;
  errors: DeliveryDetailsErrors;
  touched: boolean;
  onChange(patch: Partial<DeliveryDetails>): void;
}

export function DeliveryDetailsStep({
  headingRef,
  delivery,
  errors,
  touched,
  onChange,
}: DeliveryDetailsStepProps) {
  return (
    <div>
      <h2 ref={headingRef} tabIndex={-1}>
        Delivery details
      </h2>
      <p className="muted small">
        These notes are kept with this order on your screen only. The order system does not store
        delivery notes or a purchase order reference yet, so nothing here is sent to Carrot Cart or
        shown to the warehouse; keep a copy wherever you track purchase orders today.
      </p>

      <div className="field">
        <label htmlFor="checkout-po-reference">Purchase order reference (optional)</label>
        <input
          id="checkout-po-reference"
          type="text"
          value={delivery.purchaseOrderReference}
          maxLength={MAX_PO_REFERENCE_LENGTH + 20}
          aria-invalid={touched && errors.purchaseOrderReference ? true : undefined}
          aria-describedby={errors.purchaseOrderReference ? 'checkout-po-reference-error' : undefined}
          onChange={(e) => onChange({ purchaseOrderReference: e.target.value })}
        />
        {touched && errors.purchaseOrderReference && (
          <div className="field-error" id="checkout-po-reference-error">
            {errors.purchaseOrderReference}
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="checkout-notes">Delivery notes (optional)</label>
        <textarea
          id="checkout-notes"
          rows={4}
          value={delivery.notes}
          maxLength={MAX_NOTES_LENGTH + 50}
          aria-invalid={touched && errors.notes ? true : undefined}
          aria-describedby={errors.notes ? 'checkout-notes-error' : undefined}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
        <div className="muted small">
          {delivery.notes.length}/{MAX_NOTES_LENGTH} characters
        </div>
        {touched && errors.notes && (
          <div className="field-error" id="checkout-notes-error">
            {errors.notes}
          </div>
        )}
      </div>
    </div>
  );
}
