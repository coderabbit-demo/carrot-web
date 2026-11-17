import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { debounce } from 'lodash-es';
import { sortBy } from 'lodash-es';
import { escapeRegExp } from 'lodash-es';
import { take } from 'lodash-es';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Spinner } from '../../components/Spinner';
import { useAuth } from '../auth/AuthProvider';
import { initTemplateDb } from './db/templateDb';
import { exportTemplates } from './exportTemplates';
import { importTemplates } from './importTemplates';
import type { CheckoutTemplate, TemplateSortBy } from './db/templateTypes';
import { useCheckoutTemplates } from './useCheckoutTemplates';

interface TemplatePickerProps {
  onUseTemplate(template: CheckoutTemplate): void;
  onClose(): void;
}

const SORT_LABELS: Record<TemplateSortBy, string> = {
  recent: 'Recently used',
  created: 'Recently created',
  name: 'Name',
};

/** Wraps the part of `text` matching `term` in a `<mark>` so a search hit is easy to spot in the list. */
export function highlightMatch(text: string, term: string): ReactNode {
  const trimmed = term.trim();
  if (!trimmed) return text;
  const pattern = new RegExp(`(${escapeRegExp(trimmed)})`, 'ig');
  const parts = text.split(pattern);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="template-match">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function allTags(templates: CheckoutTemplate[]): string[] {
  const set = new Set<string>();
  for (const template of templates) {
    for (const tag of template.tags) set.add(tag);
  }
  return sortBy([...set], (tag) => tag.toLowerCase());
}

export function TemplatePicker({ onUseTemplate, onClose }: TemplatePickerProps) {
  const { organization } = useAuth();
  const { templates, loading, error, search, remove, markUsed } = useCheckoutTemplates();
  const [termInput, setTermInput] = useState('');
  const [tag, setTag] = useState('');
  const [sortBy, setSortBy] = useState<TemplateSortBy>('recent');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const debouncedSearch = useMemo(
    () =>
      debounce((term: string, currentTag: string, currentSort: TemplateSortBy) => {
        search({ term: term || undefined, tag: currentTag || undefined, sortBy: currentSort });
      }, 200),
    [search],
  );

  useEffect(() => {
    debouncedSearch(termInput, tag, sortBy);
    return () => debouncedSearch.cancel();
  }, [termInput, tag, sortBy, debouncedSearch]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, input, select, [href], [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  async function onExport() {
    if (!organization) return;
    try {
      const db = await initTemplateDb();
      exportTemplates(db, organization.id);
    } catch {
      setImportSummary('Could not export templates in this browser.');
    }
  }

  async function onImportFile(file: File) {
    if (!organization) return;
    try {
      const text = await file.text();
      const db = await initTemplateDb();
      const result = importTemplates(db, organization.id, text);
      setImportSummary(
        `Imported ${result.imported.length} template${result.imported.length === 1 ? '' : 's'}` +
          (result.skipped.length > 0
            ? `, skipped ${result.skipped.length} that did not match the expected shape.`
            : '.'),
      );
      search({ term: termInput || undefined, tag: tag || undefined, sortBy });
    } catch {
      setImportSummary('Could not read that file as a template export.');
    }
  }

  // Cap the filter dropdown so a catalog with hundreds of distinct tags doesn't make it unwieldy.
  const tags = take(allTags(templates), 20);

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal card template-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-picker-title"
        ref={dialogRef}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="template-picker-title">Saved templates</h2>

        <div className="template-picker-controls">
          <div className="field">
            <label htmlFor="template-search">Search</label>
            <input
              id="template-search"
              ref={searchInputRef}
              type="text"
              placeholder="Name, tag, or note"
              value={termInput}
              onChange={(e) => setTermInput(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="template-tag-filter">Tag</label>
            <select id="template-tag-filter" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="template-sort">Sort by</label>
            <select
              id="template-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as TemplateSortBy)}
            >
              {(Object.keys(SORT_LABELS) as TemplateSortBy[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="banner banner-error" role="alert">
            <p>{error}</p>
          </div>
        )}
        {importSummary && (
          <div className="banner banner-info" role="status">
            <p>{importSummary}</p>
          </div>
        )}

        {loading && <Spinner label="Loading saved templates…" />}

        {!loading && !error && templates.length === 0 && (
          <EmptyState title="No saved templates yet">
            <p>Save your current cart as a template from the review step to see it here.</p>
          </EmptyState>
        )}

        {!loading && templates.length > 0 && (
          <ul className="template-list" aria-label="Saved templates">
            {templates.map((template) => (
              <li
                key={template.id}
                className={clsx('template-row', { 'template-row-selected': selectedId === template.id })}
                onMouseEnter={() => setSelectedId(template.id)}
              >
                <div className="template-row-main">
                  <strong>{highlightMatch(template.name, termInput)}</strong>
                  {template.tags.length > 0 && (
                    <div className="template-tags">
                      {template.tags.map((t) => (
                        <span key={t} className="badge template-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {template.notes && <p className="muted small template-notes-preview">{template.notes}</p>}
                  <p className="muted small">
                    {template.lines.length} product{template.lines.length === 1 ? '' : 's'} · last used{' '}
                    {formatDistanceToNow(new Date(template.last_used_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="template-row-actions">
                  <Button
                    onClick={() => {
                      markUsed(template.id);
                      onUseTemplate(template);
                    }}
                  >
                    Use this template
                  </Button>
                  <Button variant="danger" onClick={() => remove(template.id)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="actions template-picker-footer">
          <Button variant="secondary" onClick={onExport} disabled={!organization}>
            Export templates
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={!organization}
          >
            Import templates
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="visually-hidden"
            aria-label="Import templates from a JSON file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImportFile(file);
              e.target.value = '';
            }}
          />
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
