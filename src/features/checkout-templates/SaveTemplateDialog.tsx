import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { uniq } from './templateLodash';
import { Button } from '../../components/Button';
import type { CartLine } from '../cart/cartLogic';
import { useCheckoutTemplates } from './useCheckoutTemplates';

interface SaveTemplateDialogProps {
  lines: CartLine[];
  onClose(): void;
}

export function splitTags(raw: string): string[] {
  return uniq(
    raw
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0),
  );
}

/** A small modal form: name (required), tags (comma-separated), notes (optional). */
export function SaveTemplateDialog({ lines, onClose }: SaveTemplateDialogProps) {
  const { save } = useCheckoutTemplates();
  const [name, setName] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'button, input, textarea, [href], [tabindex]:not([tabindex="-1"])',
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Give this template a name.');
      return;
    }
    if (lines.length === 0) {
      setError('There is nothing to save: the cart is empty.');
      return;
    }
    const result = save({
      name: trimmedName,
      tags: splitTags(tagsText),
      notes: notes.trim(),
      lines: lines.map((l) => ({ product_id: l.product_id, quantity_kg: l.quantity_kg })),
    });
    if (!result) {
      setError('Could not save the template. Try again.');
      return;
    }
    setSaved(true);
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-template-title"
        ref={dialogRef}
        onKeyDown={onKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="save-template-title">Save as template</h2>
        {saved ? (
          <div>
            <p role="status">Template "{name.trim()}" saved.</p>
            <div className="actions">
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            {error && (
              <div className="banner banner-error" role="alert">
                <p>{error}</p>
              </div>
            )}
            <div className="field">
              <label htmlFor="template-name">Name</label>
              <input
                id="template-name"
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="template-tags">Tags (comma-separated, optional)</label>
              <input
                id="template-tags"
                type="text"
                placeholder="weekly, farmers-market"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="template-notes">Notes (optional)</label>
              <textarea
                id="template-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <p className="muted small">
              {lines.length} product{lines.length === 1 ? '' : 's'} will be saved with this
              template.
            </p>
            <div className="actions">
              <Button type="submit">Save template</Button>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
