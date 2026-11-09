import { useState } from 'react';
import { Button } from '../../components/Button';
import { asApiError, userMessage } from '../../lib/api/client';
import { downloadInvoice } from './download';

interface Props {
  invoiceId: string;
  /** Invoice number such as INV-100001, used only if the server sends no file name. */
  invoiceNumber: string;
}

export function InvoiceDownloadButton({ invoiceId, invoiceNumber }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    try {
      await downloadInvoice(invoiceId, `invoice-${invoiceNumber}.html`);
    } catch (e) {
      setError(userMessage(asApiError(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="download">
      <Button variant="secondary" loading={loading} onClick={onClick}>
        Download invoice
      </Button>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
