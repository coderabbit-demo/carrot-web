export interface CheckoutKey {
  /**
   * Key for the cart contents described by `signature`; stable until the cart changes or
   * reset() is called. An optional `prefix` makes the key easier to find in logs (for example
   * by a purchase-order reference); it has no effect on whether this counts as the same attempt.
   */
  get(signature: string, prefix?: string): string;
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
    get(signature: string, prefix?: string): string {
      if (key === null || keySignature !== signature) {
        const id = generate();
        key = prefix ? `${prefix}-${id}` : id;
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
