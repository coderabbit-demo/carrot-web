import { useId } from 'react';
import { Button } from '../../components/Button';
import { isAmountText } from './invoiceQueryParams';
import { MAX_SEARCH_LENGTH } from './invoicesQuery';
import type { InvoiceQuery, QueryIssues } from './invoicesQuery';

type AmountField = 'min' | 'max';

interface Props {
  query: InvoiceQuery;
  issues: QueryIssues;
  canClear: boolean;
  onChange: (patch: Partial<InvoiceQuery>, options?: { replace?: boolean }) => void;
  onClear: () => void;
}

export function InvoiceFilters({ query, issues, canClear, onChange, onClear }: Props) {
  const id = useId();
  const searchId = `${id}-search`;
  const fromId = `${id}-from`;
  const toId = `${id}-to`;
  const minId = `${id}-min`;
  const maxId = `${id}-max`;
  const dateErrorId = `${id}-date-error`;
  const totalErrorId = `${id}-total-error`;

  // Keystrokes that would not form an amount are ignored, so the box never wipes what was typed.
  function onAmountChange(field: AmountField, raw: string) {
    const value = raw.trim();
    if (value !== '' && !isAmountText(value)) return;
    onChange(field === 'min' ? { min: value } : { max: value }, { replace: true });
  }

  return (
    <form
      className="invoice-filters card"
      role="search"
      aria-label="Filter invoices"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="field invoice-filters-search">
        <label htmlFor={searchId}>Search</label>
        <input
          id={searchId}
          type="search"
          value={query.search}
          maxLength={MAX_SEARCH_LENGTH}
          placeholder="Invoice or order number"
          autoComplete="off"
          onChange={(e) => onChange({ search: e.target.value }, { replace: true })}
        />
      </div>

      <fieldset className="invoice-filters-group">
        <legend>Issued (UTC dates)</legend>
        <div className="invoice-filters-pair">
          <div className="field">
            <label htmlFor={fromId}>From</label>
            <input
              id={fromId}
              type="date"
              value={query.from}
              max={query.to || undefined}
              aria-invalid={issues.dateRange ? true : undefined}
              aria-describedby={issues.dateRange ? dateErrorId : undefined}
              onChange={(e) => onChange({ from: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor={toId}>To</label>
            <input
              id={toId}
              type="date"
              value={query.to}
              min={query.from || undefined}
              aria-invalid={issues.dateRange ? true : undefined}
              aria-describedby={issues.dateRange ? dateErrorId : undefined}
              onChange={(e) => onChange({ to: e.target.value })}
            />
          </div>
        </div>
        {issues.dateRange && (
          <p id={dateErrorId} className="field-error" role="alert">
            {issues.dateRange}
          </p>
        )}
      </fieldset>

      <fieldset className="invoice-filters-group">
        <legend>Total</legend>
        <div className="invoice-filters-pair">
          <div className="field">
            <label htmlFor={minId}>Minimum</label>
            <input
              id={minId}
              type="text"
              inputMode="decimal"
              value={query.min}
              placeholder="0.00"
              autoComplete="off"
              aria-invalid={issues.totalRange ? true : undefined}
              aria-describedby={issues.totalRange ? totalErrorId : undefined}
              onChange={(e) => onAmountChange('min', e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={maxId}>Maximum</label>
            <input
              id={maxId}
              type="text"
              inputMode="decimal"
              value={query.max}
              placeholder="0.00"
              autoComplete="off"
              aria-invalid={issues.totalRange ? true : undefined}
              aria-describedby={issues.totalRange ? totalErrorId : undefined}
              onChange={(e) => onAmountChange('max', e.target.value)}
            />
          </div>
        </div>
        {issues.totalRange && (
          <p id={totalErrorId} className="field-error" role="alert">
            {issues.totalRange}
          </p>
        )}
      </fieldset>

      <div className="invoice-filters-actions">
        <Button variant="secondary" disabled={!canClear} onClick={onClear}>
          Clear filters
        </Button>
      </div>
    </form>
  );
}
