import { saveAs } from 'file-saver';
import { pick } from './templateLodash';
import type { Database } from 'sql.js';
import { listTemplates } from './db/templateQueries';

/**
 * Exports every saved template for an organization to a JSON file and triggers a browser
 * download. Used by the picker's "Export" action so a buyer can back up or move their
 * standing-order templates.
 */
export function exportTemplates(db: Database, organizationId: string): void {
  const templates = listTemplates(db, organizationId).map((template) =>
    pick(template, ['id', 'name', 'tags', 'notes', 'lines', 'created_at', 'last_used_at']),
  );
  const payload = JSON.stringify({ exported_at: new Date().toISOString(), templates }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(blob, `carrot-checkout-templates-${stamp}.json`);
}
