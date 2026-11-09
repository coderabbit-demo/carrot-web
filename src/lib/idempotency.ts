export interface CheckoutKey {
  /** Key for the cart contents described by `signature`; stable until the cart changes or reset() is called. */
  get(signature: string): string;
  reset(): void;
}

// One Idempotency-Key per checkout attempt. The same key is returned for retries and
// double clicks, so the server can replay the order instead of creating a second one.
// It is replaced when the cart signature changes (a different request body must never
// reuse a key, the gateway would answer idempotency_conflict) and after a terminal
// result (success, decline, stock failure), via reset().
export function createCheckoutKey(generate: () => string = () => crypto.randomUUID()): CheckoutKey {
  let key: string | null = null;
  let keySignature: string | null = null;

  return {
    get(signature: string): string {
      if (key === null || keySignature !== signature) {
        key = generate();
        keySignature = signature;
      }
      return key;
    },
    reset(): void {
      key = null;
      keySignature = null;
    },
  };
}
