import { uniq } from 'lodash-es';
import { sortBy } from 'lodash-es';
import { truncate } from 'lodash-es';

/** A short, sorted, deduped list of product names for an order row, e.g. "Classic, Purple". */
export function summarizeOrderProducts(lines: { name: string }[]): string {
  const names = sortBy(uniq(lines.map((l) => l.name)), (name) => name.toLowerCase());
  return truncate(names.join(', '), { length: 60 });
}

export function formatKg(kg: number): string {
  return `${kg.toLocaleString('en-US')} kg`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
