import type { InvoiceSortKey, SortDirection } from './invoicesQuery';

interface Props {
  label: string;
  sortKey: InvoiceSortKey;
  activeSort: InvoiceSortKey;
  direction: SortDirection;
  numeric?: boolean;
  onSort: (key: InvoiceSortKey) => void;
}

export function SortableHeader({ label, sortKey, activeSort, direction, numeric, onSort }: Props) {
  const active = activeSort === sortKey;
  const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none';
  const arrow = active ? (direction === 'asc' ? '▲' : '▼') : '';

  return (
    <th scope="col" className={numeric ? 'num' : undefined} aria-sort={ariaSort}>
      <button type="button" className="sort-button" onClick={() => onSort(sortKey)}>
        {label}
        <span className="sort-arrow" aria-hidden="true">
          {arrow}
        </span>
      </button>
    </th>
  );
}
