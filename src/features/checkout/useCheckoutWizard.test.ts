import { describe, expect, it } from 'vitest';
import {
  hasDeliveryErrors,
  isStepValid,
  validateDeliveryDetails,
  wizardReducer,
} from './useCheckoutWizard';
import { EMPTY_DELIVERY_DETAILS } from './checkoutWizard.types';
import type { WizardState } from './checkoutWizard.types';
import type { CartLine } from '../cart/cartLogic';

function line(id: string): CartLine {
  return {
    product_id: id,
    sku: `SKU-${id}`,
    name: `Product ${id}`,
    unit_price: { amount_minor: 100, currency: 'USD' },
    quantity_kg: 5,
  };
}

function baseState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    stepIndex: 0,
    delivery: EMPTY_DELIVERY_DETAILS,
    deliveryTouched: false,
    submitting: false,
    failure: null,
    order: null,
    draftLines: [line('a')],
    ...overrides,
  };
}

describe('validateDeliveryDetails', () => {
  it('accepts an empty form, since both fields are optional', () => {
    const errors = validateDeliveryDetails(EMPTY_DELIVERY_DETAILS);
    expect(hasDeliveryErrors(errors)).toBe(false);
  });

  it('rejects notes over the length limit', () => {
    const errors = validateDeliveryDetails({
      notes: 'x'.repeat(501),
      purchaseOrderReference: '',
    });
    expect(errors.notes).not.toBeNull();
    expect(hasDeliveryErrors(errors)).toBe(true);
  });

  it('rejects a purchase order reference over the length limit', () => {
    const errors = validateDeliveryDetails({
      notes: '',
      purchaseOrderReference: 'x'.repeat(51),
    });
    expect(errors.purchaseOrderReference).not.toBeNull();
  });

  it('accepts values right at the limit', () => {
    const errors = validateDeliveryDetails({
      notes: 'x'.repeat(500),
      purchaseOrderReference: 'x'.repeat(50),
    });
    expect(hasDeliveryErrors(errors)).toBe(false);
  });
});

describe('isStepValid', () => {
  it('requires at least one cart line to leave the review step', () => {
    expect(isStepValid('review', baseState({ draftLines: [] }))).toBe(false);
    expect(isStepValid('review', baseState({ draftLines: [line('a')] }))).toBe(true);
  });

  it('blocks the delivery step when a field is too long', () => {
    const state = baseState({ delivery: { notes: 'x'.repeat(600), purchaseOrderReference: '' } });
    expect(isStepValid('delivery', state)).toBe(false);
  });

  it('blocks the confirm step while a submit is in flight', () => {
    expect(isStepValid('confirm', baseState({ submitting: true }))).toBe(false);
    expect(isStepValid('confirm', baseState({ submitting: false }))).toBe(true);
  });

  it('the success step has no requirements of its own', () => {
    expect(isStepValid('success', baseState({ draftLines: [] }))).toBe(true);
  });
});

describe('wizardReducer', () => {
  it('advances to the next step only when the current step is valid', () => {
    const invalid = baseState({ draftLines: [] });
    expect(wizardReducer(invalid, { type: 'go_next' }).stepIndex).toBe(0);

    const valid = baseState();
    expect(wizardReducer(valid, { type: 'go_next' }).stepIndex).toBe(1);
  });

  it('does not advance past the last step', () => {
    const atEnd = baseState({ stepIndex: 3 });
    expect(wizardReducer(atEnd, { type: 'go_next' }).stepIndex).toBe(3);
  });

  it('goes back a step, but never past the first', () => {
    const atFirst = baseState({ stepIndex: 0 });
    expect(wizardReducer(atFirst, { type: 'go_back' }).stepIndex).toBe(0);

    const atSecond = baseState({ stepIndex: 1 });
    expect(wizardReducer(atSecond, { type: 'go_back' }).stepIndex).toBe(0);
  });

  it('refuses to go back from the success step', () => {
    const atSuccess = baseState({ stepIndex: 3, order: null });
    expect(wizardReducer(atSuccess, { type: 'go_back' }).stepIndex).toBe(3);
  });

  it('jumps directly to a named step', () => {
    const state = baseState({ stepIndex: 0 });
    expect(wizardReducer(state, { type: 'go_to_step', step: 'confirm' }).stepIndex).toBe(2);
  });

  it('merges a delivery patch and marks the form touched', () => {
    const state = baseState();
    const next = wizardReducer(state, { type: 'set_delivery', delivery: { notes: 'Leave at the back door' } });
    expect(next.delivery.notes).toBe('Leave at the back door');
    expect(next.delivery.purchaseOrderReference).toBe('');
    expect(next.deliveryTouched).toBe(true);
  });

  it('moves to the success step and records the order on submit_succeeded', () => {
    const state = baseState({ stepIndex: 2, submitting: true });
    const order = {
      id: 'o1',
      number: 'ORD-1',
      status: 'confirmed' as const,
      lines: [],
      total: { amount_minor: 0, currency: 'USD' },
      invoice_id: null,
      failure_code: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    const next = wizardReducer(state, { type: 'submit_succeeded', order });
    expect(next.stepIndex).toBe(3);
    expect(next.submitting).toBe(false);
    expect(next.order).toEqual(order);
  });

  it('records a failure without changing the step', () => {
    const state = baseState({ stepIndex: 2, submitting: true });
    const failure = {
      kind: 'retry' as const,
      message: 'try again',
      terminal: false,
      items: [],
    };
    const next = wizardReducer(state, { type: 'submit_failed', failure });
    expect(next.submitting).toBe(false);
    expect(next.failure).toEqual(failure);
    expect(next.stepIndex).toBe(2);
  });

  it('replaces the draft lines without touching other state', () => {
    const state = baseState();
    const next = wizardReducer(state, { type: 'set_draft_lines', lines: [line('x'), line('y')] });
    expect(next.draftLines.map((l) => l.product_id)).toEqual(['x', 'y']);
    expect(next.stepIndex).toBe(state.stepIndex);
  });
});
