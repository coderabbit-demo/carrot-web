import type { Money as MoneyValue } from '../lib/api/types';
import { formatMoney } from '../lib/money';

export function Money({ value }: { value: MoneyValue }) {
  return <span className="money">{formatMoney(value)}</span>;
}
