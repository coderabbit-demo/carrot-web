import { Money } from '../../../components/Money';
import { formatKg } from '../../../lib/format';
import type { Order } from '../../../lib/api/types';
import { linesSummary, orderTotals } from './orderDetailModel';

export function OrderLinesTable({ order }: { order: Order }) {
  return (
    <>
      <div className="table-wrap order-lines">
        <table className="data-table">
          <caption className="order-sr-only">Products in order {order.number}</caption>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col" className="num">
                Quantity
              </th>
              <th scope="col" className="num">
                Price
              </th>
              <th scope="col" className="num">
                Line total
              </th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.product_id}>
                <td>
                  {line.name}
                  <div className="muted small">{line.sku}</div>
                </td>
                <td className="num">{formatKg(line.quantity_kg)}</td>
                <td className="num">
                  <Money value={line.unit_price} /> / kg
                </td>
                <td className="num">
                  <Money value={line.line_total} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total</td>
              <td className="num">
                <Money value={order.total} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="muted small order-lines-summary">{linesSummary(orderTotals(order), formatKg)}</p>
    </>
  );
}
