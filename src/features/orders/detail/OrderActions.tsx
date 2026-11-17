import { Button } from '../../../components/Button';
import type { Order } from '../../../lib/api/types';
import { InvoiceDownloadButton } from '../../invoices/InvoiceDownloadButton';
import type { OrderActions as OrderCapabilities } from '../orderActions';
import { CopyOrderNumber } from './CopyOrderNumber';
import { invoiceNumberFor } from './orderDetailModel';

interface Props {
  order: Order;
  capabilities: OrderCapabilities;
  cancelling: boolean;
  onCancel: () => void;
  onPrint: () => void;
}

export function OrderActions({ order, capabilities, cancelling, onCancel, onPrint }: Props) {
  return (
    <div className="actions no-print">
      {order.invoice_id && (
        <InvoiceDownloadButton invoiceId={order.invoice_id} invoiceNumber={invoiceNumberFor(order.number)} />
      )}
      <Button variant="secondary" onClick={onPrint}>
        Print receipt
      </Button>
      <CopyOrderNumber orderNumber={order.number} />
      {capabilities.canCancel && (
        <Button variant="danger" loading={cancelling} onClick={onCancel}>
          Cancel order
        </Button>
      )}
    </div>
  );
}
