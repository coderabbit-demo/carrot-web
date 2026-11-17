import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { asApiError } from '../../lib/api/client';
import { createOrder } from '../../lib/api/endpoints';
import { createCheckoutKey } from '../../lib/idempotency';
import { useCart } from '../cart/CartProvider';
import { cartSignature } from '../cart/cartLogic';
import { describeCheckoutError } from '../cart/checkoutError';
import type { StockShortage } from '../../lib/api/types';
import './checkout.css';
import { CHECKOUT_STEPS } from './checkoutWizard.types';
import type { CheckoutStepId, DeliveryDetails } from './checkoutWizard.types';
import { useCheckoutWizard } from './useCheckoutWizard';
import { ReviewCartStep } from './steps/ReviewCartStep';
import { DeliveryDetailsStep } from './steps/DeliveryDetailsStep';
import { ConfirmReviewStep } from './steps/ConfirmReviewStep';
import { SuccessStep } from './steps/SuccessStep';

const STEP_LABELS: Record<CheckoutStepId, string> = {
  review: 'Review cart',
  delivery: 'Delivery details',
  confirm: 'Confirm',
  success: 'Success',
};

// The delivery details are part of what's being submitted, so a change to either one counts as
// a different checkout attempt for idempotency purposes, same as a change to the cart lines.
function checkoutSignature(lines: Parameters<typeof cartSignature>[0], delivery: DeliveryDetails): string {
  return `${cartSignature(lines)}|${delivery.purchaseOrderReference.trim()}|${delivery.notes.trim()}`;
}

// A prefix built from the cart's own product ids, so a bulk order's line items show up next to
// it in server logs and support can tell which SKUs an attempt touched without opening the order
// record. Purely cosmetic: it has no bearing on whether two requests count as the same attempt.
function skuKeyPrefix(lines: Parameters<typeof cartSignature>[0]): string {
  return lines.map((l) => l.product_id).join('-');
}

// Bounds how long the confirm step waits on a slow connection before treating the attempt as
// failed, so the spinner doesn't run indefinitely.
const PLACE_ORDER_TIMEOUT_MS = 10_000;

/**
 * The four-step guided checkout: review the cart, add optional delivery details, confirm and
 * place the order, then a success screen. Only the confirm step calls the orders API; the other
 * steps only manage local wizard state and the existing cart.
 */
export function CheckoutWizard() {
  const navigate = useNavigate();
  const cart = useCart();
  const wizard = useCheckoutWizard();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const checkoutKey = useRef(createCheckoutKey());
  const inFlight = useRef(false);

  // Move focus to the new step's heading on every transition, for both keyboard and screen-reader users.
  useEffect(() => {
    headingRef.current?.focus();
  }, [wizard.step]);

  async function placeOrder() {
    if (inFlight.current || wizard.cartLines.length === 0) return;
    inFlight.current = true;
    wizard.startSubmit();

    const key = checkoutKey.current.get(
      checkoutSignature(wizard.cartLines, wizard.state.delivery),
      skuKeyPrefix(wizard.cartLines),
    );
    try {
      const order = await createOrder(
        {
          lines: wizard.cartLines.map((l) => ({ product_id: l.product_id, quantity_kg: l.quantity_kg })),
        },
        key,
        AbortSignal.timeout(PLACE_ORDER_TIMEOUT_MS),
      );
      checkoutKey.current.reset();
      cart.clear();
      wizard.succeedSubmit(order);
    } catch (e) {
      const described = describeCheckoutError(asApiError(e));
      if (described.terminal) checkoutKey.current.reset();
      wizard.failSubmit(described);
    } finally {
      inFlight.current = false;
    }
  }

  function adjustQuantities(items: StockShortage[]) {
    cart.adjustToAvailability(items);
  }

  const currentIndex = CHECKOUT_STEPS.indexOf(wizard.step);

  return (
    <section className="checkout-wizard">
      <h1>Checkout</h1>
      <ol className="checkout-steps" aria-label="Checkout progress">
        {CHECKOUT_STEPS.map((step, index) => (
          <li
            key={step}
            className={
              index === currentIndex
                ? 'checkout-step checkout-step-current'
                : index < currentIndex
                  ? 'checkout-step checkout-step-done'
                  : 'checkout-step'
            }
            aria-current={index === currentIndex ? 'step' : undefined}
          >
            <span className="checkout-step-number">{index + 1}</span>
            <span>{STEP_LABELS[step]}</span>
          </li>
        ))}
      </ol>
      <div aria-live="polite" className="visually-hidden">
        Step {wizard.stepNumber} of {wizard.totalSteps}: {STEP_LABELS[wizard.step]}
      </div>

      {wizard.step === 'review' && <ReviewCartStep headingRef={headingRef} />}
      {wizard.step === 'delivery' && (
        <DeliveryDetailsStep
          headingRef={headingRef}
          delivery={wizard.state.delivery}
          errors={wizard.deliveryErrors}
          touched={wizard.state.deliveryTouched}
          onChange={wizard.setDelivery}
        />
      )}
      {wizard.step === 'confirm' && (
        <ConfirmReviewStep
          headingRef={headingRef}
          lines={wizard.cartLines}
          delivery={wizard.state.delivery}
          submitting={wizard.state.submitting}
          failure={wizard.state.failure}
          onPlaceOrder={placeOrder}
          onAdjustQuantities={adjustQuantities}
        />
      )}
      {wizard.step === 'success' && wizard.state.order && (
        <SuccessStep headingRef={headingRef} order={wizard.state.order} />
      )}

      {wizard.step !== 'success' && (
        <div className="actions checkout-nav">
          <Button variant="secondary" disabled={!wizard.canGoBack} onClick={wizard.goBack}>
            Back
          </Button>
          {wizard.step !== 'confirm' && (
            <Button disabled={!wizard.canGoNext} onClick={wizard.goNext}>
              Next
            </Button>
          )}
          {wizard.step === 'confirm' && (
            <Button variant="secondary" onClick={() => navigate('/cart')}>
              Edit cart instead
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
