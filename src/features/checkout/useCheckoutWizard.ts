import { useCallback, useEffect, useMemo, useReducer } from 'react';
import type { CartLine } from '../cart/cartLogic';
import { useCart } from '../cart/CartProvider';
import {
  CHECKOUT_STEPS,
  EMPTY_DELIVERY_DETAILS,
  MAX_NOTES_LENGTH,
  MAX_PO_REFERENCE_LENGTH,
} from './checkoutWizard.types';
import type {
  CheckoutStepId,
  DeliveryDetails,
  DeliveryDetailsErrors,
  WizardAction,
  WizardState,
} from './checkoutWizard.types';

const INITIAL_STATE: WizardState = {
  stepIndex: 0,
  delivery: EMPTY_DELIVERY_DETAILS,
  deliveryTouched: false,
  submitting: false,
  failure: null,
  order: null,
  draftLines: [],
};

/** Validates the delivery-details step. Both fields are optional, so an empty form is always valid. */
export function validateDeliveryDetails(delivery: DeliveryDetails): DeliveryDetailsErrors {
  const errors: DeliveryDetailsErrors = { notes: null, purchaseOrderReference: null };
  if (delivery.notes.length > MAX_NOTES_LENGTH) {
    errors.notes = `Delivery notes must be ${MAX_NOTES_LENGTH} characters or fewer.`;
  }
  if (delivery.purchaseOrderReference.length > MAX_PO_REFERENCE_LENGTH) {
    errors.purchaseOrderReference = `Purchase order reference must be ${MAX_PO_REFERENCE_LENGTH} characters or fewer.`;
  }
  return errors;
}

export function hasDeliveryErrors(errors: DeliveryDetailsErrors): boolean {
  return errors.notes !== null || errors.purchaseOrderReference !== null;
}

/** True when the given step's own requirements are satisfied, independent of later steps. */
export function isStepValid(step: CheckoutStepId, state: WizardState): boolean {
  if (step === 'review') return state.draftLines.length > 0;
  if (step === 'delivery') return !hasDeliveryErrors(validateDeliveryDetails(state.delivery));
  if (step === 'confirm') return state.draftLines.length > 0 && !state.submitting;
  return true;
}

function stepAt(index: number): CheckoutStepId {
  return CHECKOUT_STEPS[Math.min(Math.max(index, 0), CHECKOUT_STEPS.length - 1)];
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'go_next': {
      const current = stepAt(state.stepIndex);
      if (!isStepValid(current, state)) return state;
      const nextIndex = Math.min(state.stepIndex + 1, CHECKOUT_STEPS.length - 1);
      return { ...state, stepIndex: nextIndex, failure: null };
    }
    case 'go_back': {
      // The success step is terminal: once an order exists there is no cart left to review.
      if (stepAt(state.stepIndex) === 'success') return state;
      const prevIndex = Math.max(state.stepIndex - 1, 0);
      return { ...state, stepIndex: prevIndex, failure: null };
    }
    case 'go_to_step': {
      const targetIndex = CHECKOUT_STEPS.indexOf(action.step);
      if (targetIndex === -1) return state;
      return { ...state, stepIndex: targetIndex, failure: null };
    }
    case 'set_delivery':
      return {
        ...state,
        delivery: { ...state.delivery, ...action.delivery },
        deliveryTouched: true,
      };
    case 'touch_delivery':
      return { ...state, deliveryTouched: true };
    case 'set_draft_lines':
      return { ...state, draftLines: action.lines };
    case 'submit_start':
      return { ...state, submitting: true, failure: null };
    case 'submit_failed':
      return { ...state, submitting: false, failure: action.failure };
    case 'submit_succeeded':
      return {
        ...state,
        submitting: false,
        failure: null,
        order: action.order,
        stepIndex: CHECKOUT_STEPS.indexOf('success'),
      };
    case 'reset':
      return INITIAL_STATE;
    default:
      return state;
  }
}

export interface UseCheckoutWizard {
  state: WizardState;
  step: CheckoutStepId;
  stepNumber: number;
  totalSteps: number;
  canGoNext: boolean;
  canGoBack: boolean;
  cartLines: CartLine[];
  deliveryErrors: DeliveryDetailsErrors;
  goNext(): void;
  goBack(): void;
  setDelivery(patch: Partial<DeliveryDetails>): void;
  startSubmit(): void;
  failSubmit(failure: WizardState['failure']): void;
  succeedSubmit(order: WizardState['order']): void;
  reset(): void;
}

/**
 * Drives the four-step checkout flow. Cart lines come from the existing `useCart()` hook;
 * this hook never talks to the server itself, it only tracks which step the buyer is on,
 * the optional delivery-details draft, and the outcome of the final submit.
 */
export function useCheckoutWizard(): UseCheckoutWizard {
  const cart = useCart();
  const [state, dispatch] = useReducer(wizardReducer, {
    ...INITIAL_STATE,
    draftLines: cart.lines,
  });

  // The wizard's draft mirrors the live cart, so loading a template (which mutates the cart
  // through the same add/setQuantity functions the review step already uses) is reflected here
  // without the wizard reaching into cart internals of its own.
  useEffect(() => {
    dispatch({ type: 'set_draft_lines', lines: cart.lines });
  }, [cart.lines]);

  const step = stepAt(state.stepIndex);
  const deliveryErrors = useMemo(() => validateDeliveryDetails(state.delivery), [state.delivery]);

  const canGoNext = useMemo(() => isStepValid(step, state) && step !== 'success', [state, step]);
  const canGoBack = step !== 'review' && step !== 'success';

  const goNext = useCallback(() => dispatch({ type: 'go_next' }), []);
  const goBack = useCallback(() => dispatch({ type: 'go_back' }), []);
  const setDelivery = useCallback(
    (patch: Partial<DeliveryDetails>) => dispatch({ type: 'set_delivery', delivery: patch }),
    [],
  );
  const startSubmit = useCallback(() => dispatch({ type: 'submit_start' }), []);
  const failSubmit = useCallback(
    (failure: WizardState['failure']) => failure && dispatch({ type: 'submit_failed', failure }),
    [],
  );
  const succeedSubmit = useCallback(
    (order: WizardState['order']) => order && dispatch({ type: 'submit_succeeded', order }),
    [],
  );
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return {
    state,
    step,
    stepNumber: state.stepIndex + 1,
    totalSteps: CHECKOUT_STEPS.length,
    canGoNext,
    canGoBack,
    cartLines: state.draftLines,
    deliveryErrors,
    goNext,
    goBack,
    setDelivery,
    startSubmit,
    failSubmit,
    succeedSubmit,
    reset,
  };
}
