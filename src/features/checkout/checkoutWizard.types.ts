import type { CartLine } from '../cart/cartLogic';
import type { CheckoutFailure } from '../cart/checkoutError';
import type { Order } from '../../lib/api/types';

export const CHECKOUT_STEPS = ['review', 'delivery', 'confirm', 'success'] as const;

export type CheckoutStepId = (typeof CHECKOUT_STEPS)[number];

export interface DeliveryDetails {
  /** Free text. Not sent to the orders API yet; the gateway has no field for it. */
  notes: string;
  /** Free text. Same limitation as `notes`. */
  purchaseOrderReference: string;
}

export const EMPTY_DELIVERY_DETAILS: DeliveryDetails = {
  notes: '',
  purchaseOrderReference: '',
};

export const MAX_NOTES_LENGTH = 500;
export const MAX_PO_REFERENCE_LENGTH = 50;

export interface DeliveryDetailsErrors {
  notes: string | null;
  purchaseOrderReference: string | null;
}

export interface WizardState {
  stepIndex: number;
  delivery: DeliveryDetails;
  deliveryTouched: boolean;
  submitting: boolean;
  failure: CheckoutFailure | null;
  order: Order | null;
  /** The cart lines as they stood when the wizard started reviewing them, for an undo-free "replace with template" flow. */
  draftLines: CartLine[];
}

export type WizardAction =
  | { type: 'go_next' }
  | { type: 'go_back' }
  | { type: 'go_to_step'; step: CheckoutStepId }
  | { type: 'set_delivery'; delivery: Partial<DeliveryDetails> }
  | { type: 'touch_delivery' }
  | { type: 'set_draft_lines'; lines: CartLine[] }
  | { type: 'submit_start' }
  | { type: 'submit_failed'; failure: CheckoutFailure }
  | { type: 'submit_succeeded'; order: Order }
  | { type: 'reset' };
