import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrder } from '../../../lib/api/endpoints';
import type { Order } from '../../../lib/api/types';
import { createPoller } from './paymentPoller';
import type { CheckOutcome, Poller, PollerSnapshot } from './paymentPoller';
import { shouldPoll } from './pollSchedule';

const IDLE: PollerSnapshot = { state: 'idle', attempts: 0, inFlight: false };

interface Options {
  orderId: string;
  /** Status of the order currently on screen; polling runs only while the payment is undecided. */
  status: Order['status'] | null;
  onOrder: (order: Order) => void;
}

/**
 * Re-fetches a payment_pending order on a backoff schedule. It stops on a final status, on unmount
 * and while the tab is hidden. `checkNow` runs a manual check through the same single request slot.
 */
export function usePaymentPolling({ orderId, status, onOrder }: Options) {
  const [snapshot, setSnapshot] = useState<PollerSnapshot>(IDLE);
  const pollerRef = useRef<Poller<Order> | null>(null);
  const onOrderRef = useRef(onOrder);
  const watching = status !== null && shouldPoll(status);

  useEffect(() => {
    onOrderRef.current = onOrder;
  });

  useEffect(() => {
    if (!watching) {
      setSnapshot(IDLE);
      return;
    }

    // The poller reports from timers and in-flight requests; nothing may reach React state once this
    // effect has been cleaned up (unmount, or a new order id / status).
    let disposed = false;
    const poller = createPoller<Order>({
      fetch: () => getOrder(orderId),
      shouldContinue: (order) => shouldPoll(order.status),
      onResult: (order) => onOrderRef.current(order),
      onChange: (next) => {
        if (!disposed) setSnapshot(next);
      },
    });
    pollerRef.current = poller;
    poller.start();
    if (document.hidden) poller.pause();

    const onVisibility = () => {
      if (document.hidden) poller.pause();
      else poller.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      disposed = true;
      poller.stop();
      if (pollerRef.current === poller) pollerRef.current = null;
    };
  }, [orderId, watching]);

  const checkNow = useCallback((fetcher: () => Promise<Order>): Promise<CheckOutcome<Order>> => {
    const poller = pollerRef.current;
    return poller ? poller.manualCheck(fetcher) : Promise.resolve<CheckOutcome<Order>>({ kind: 'inactive' });
  }, []);

  return { state: snapshot.state, inFlight: snapshot.inFlight, checkNow };
}
