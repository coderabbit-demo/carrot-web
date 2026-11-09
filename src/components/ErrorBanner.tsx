import { userMessage } from '../lib/api/client';
import type { ApiError } from '../lib/api/client';
import { Button } from './Button';

interface ErrorBannerProps {
  error: ApiError | string;
  onRetry?: () => void;
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  const message = typeof error === 'string' ? error : userMessage(error);
  const requestId = typeof error === 'string' ? undefined : error.requestId;
  return (
    <div className="banner banner-error" role="alert">
      <div>
        <p>{message}</p>
        {requestId && <p className="banner-meta">Reference: {requestId}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
