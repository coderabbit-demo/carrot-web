import { useId } from 'react';
import { Button } from '../../components/Button';
import { pageWindow } from './invoicesQuery';

interface Props {
  page: number;
  pageCount: number;
  pageSize: number;
  pageSizes: readonly number[];
  start: number;
  end: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  pageSizes,
  start,
  end,
  total,
  onPage,
  onPageSize,
}: Props) {
  const sizeId = useId();

  return (
    <div className="pagination">
      <p className="pagination-summary muted" role="status">
        {total === 0 ? 'No invoices to show' : `Showing ${start}–${end} of ${total}`}
      </p>

      <nav aria-label="Invoice pages" className="pagination-pages">
        <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <ul className="pagination-list">
          {pageWindow(page, pageCount).map((entry, index) =>
            entry === 'gap' ? (
              <li key={`gap-${index}`} aria-hidden="true" className="pagination-gap">
                …
              </li>
            ) : (
              <li key={entry}>
                <button
                  type="button"
                  className="pagination-page"
                  aria-label={`Page ${entry}`}
                  aria-current={entry === page ? 'page' : undefined}
                  onClick={() => onPage(entry)}
                >
                  {entry}
                </button>
              </li>
            ),
          )}
        </ul>
        <Button variant="secondary" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </nav>

      <div className="pagination-size">
        <label htmlFor={sizeId}>Rows per page</label>
        <select id={sizeId} value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
