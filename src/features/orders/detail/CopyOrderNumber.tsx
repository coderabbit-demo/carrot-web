import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/Button';
import { copyText } from './clipboard';

type CopyState = 'idle' | 'copied' | 'failed';

const RESET_AFTER_MS = 3000;

export function CopyOrderNumber({ orderNumber }: { orderNumber: string }) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  async function onCopy() {
    const ok = await copyText(orderNumber);
    setState(ok ? 'copied' : 'failed');
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), RESET_AFTER_MS);
  }

  return (
    <span className="copy-order">
      <Button variant="secondary" onClick={onCopy} aria-label={`Copy order number ${orderNumber}`}>
        Copy order number
      </Button>
      <span className={state === 'failed' ? 'field-error' : 'muted small'} role="status">
        {state === 'copied' && 'Order number copied.'}
        {state === 'failed' && 'Could not copy. Select the number in the heading and copy it manually.'}
      </span>
    </span>
  );
}
