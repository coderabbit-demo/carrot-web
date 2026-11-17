import { v4 as uuidv4 } from 'uuid';
import type { Database } from 'sql.js';
import type {
  CheckoutTemplate,
  CheckoutTemplateRow,
  CreateTemplateInput,
  TemplateSearchParams,
  UpdateTemplateInput,
} from './templateTypes';

const SORT_COLUMNS: Record<NonNullable<TemplateSearchParams['sortBy']>, string> = {
  name: 'name',
  recent: 'last_used_at',
  created: 'created_at',
};

function rowToTemplate(row: CheckoutTemplateRow): CheckoutTemplate {
  let tags: string[] = [];
  let lines: CheckoutTemplate['lines'] = [];
  try {
    tags = row.tags ? (JSON.parse(row.tags) as string[]) : [];
  } catch {
    tags = [];
  }
  try {
    lines = JSON.parse(row.lines_json) as CheckoutTemplate['lines'];
  } catch {
    lines = [];
  }
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    tags,
    notes: row.notes,
    lines,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
  };
}

/** Converts a sql.js `db.exec` result set into typed template rows. */
function rowsToTemplates(result: ReturnType<Database['exec']>): CheckoutTemplate[] {
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((value) => {
    const record: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      record[column] = value[index];
    });
    return rowToTemplate(record as unknown as CheckoutTemplateRow);
  });
}

/**
 * Inserts a new template for `organizationId` and returns it. Uses a parameterized statement;
 * none of the caller-provided values are interpolated into SQL text.
 */
export function createTemplate(
  db: Database,
  organizationId: string,
  input: CreateTemplateInput,
): CheckoutTemplate {
  const now = new Date().toISOString();
  const row: CheckoutTemplateRow = {
    id: uuidv4(),
    organization_id: organizationId,
    name: input.name,
    tags: JSON.stringify(input.tags),
    notes: input.notes,
    lines_json: JSON.stringify(input.lines),
    created_at: now,
    last_used_at: now,
  };
  const stmt = db.prepare(
    `INSERT INTO checkout_templates
      (id, organization_id, name, tags, notes, lines_json, created_at, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  try {
    stmt.run([
      row.id,
      row.organization_id,
      row.name,
      row.tags,
      row.notes,
      row.lines_json,
      row.created_at,
      row.last_used_at,
    ]);
  } finally {
    stmt.free();
  }
  return rowToTemplate(row);
}

/** Applies a partial update to one template, scoped by id and organization. Parameterized. */
export function updateTemplate(
  db: Database,
  id: string,
  organizationId: string,
  patch: UpdateTemplateInput,
): void {
  const assignments: string[] = [];
  const params: unknown[] = [];

  if (patch.name !== undefined) {
    assignments.push('name = ?');
    params.push(patch.name);
  }
  if (patch.tags !== undefined) {
    assignments.push('tags = ?');
    params.push(JSON.stringify(patch.tags));
  }
  if (patch.notes !== undefined) {
    assignments.push('notes = ?');
    params.push(patch.notes);
  }
  if (patch.lines !== undefined) {
    assignments.push('lines_json = ?');
    params.push(JSON.stringify(patch.lines));
  }
  if (assignments.length === 0) return;

  const stmt = db.prepare(
    `UPDATE checkout_templates SET ${assignments.join(', ')} WHERE id = ? AND organization_id = ?`,
  );
  try {
    stmt.run([...params, id, organizationId]);
  } finally {
    stmt.free();
  }
}

/** Marks a template as just used, bumping `last_used_at` to now. Parameterized. */
export function touchTemplate(db: Database, id: string, organizationId: string): void {
  const stmt = db.prepare(
    'UPDATE checkout_templates SET last_used_at = ? WHERE id = ? AND organization_id = ?',
  );
  try {
    stmt.run([new Date().toISOString(), id, organizationId]);
  } finally {
    stmt.free();
  }
}

/** Deletes one template, scoped by both id and organization so templates cannot cross organizations. Parameterized. */
export function deleteTemplate(db: Database, id: string, organizationId: string): void {
  const stmt = db.prepare('DELETE FROM checkout_templates WHERE id = ? AND organization_id = ?');
  try {
    stmt.run([id, organizationId]);
  } finally {
    stmt.free();
  }
}

/** Reads one template, scoped by both id and organization. Parameterized. */
export function getTemplateById(
  db: Database,
  id: string,
  organizationId: string,
): CheckoutTemplate | null {
  const stmt = db.prepare('SELECT * FROM checkout_templates WHERE id = ? AND organization_id = ?');
  try {
    stmt.bind([id, organizationId]);
    if (!stmt.step()) return null;
    return rowToTemplate(stmt.getAsObject() as unknown as CheckoutTemplateRow);
  } finally {
    stmt.free();
  }
}

/** Lists every template for an organization, most recently used first. Parameterized. */
export function listTemplates(db: Database, organizationId: string): CheckoutTemplate[] {
  const stmt = db.prepare(
    'SELECT * FROM checkout_templates WHERE organization_id = ? ORDER BY last_used_at DESC',
  );
  const rows: CheckoutTemplate[] = [];
  try {
    stmt.bind([organizationId]);
    while (stmt.step()) {
      rows.push(rowToTemplate(stmt.getAsObject() as unknown as CheckoutTemplateRow));
    }
  } finally {
    stmt.free();
  }
  return rows;
}

/**
 * Filters and sorts templates for the picker's search box, tag filter, and sort dropdown.
 * `sortBy` is looked up against a fixed column map so only a known, safe column name ever
 * reaches the ORDER BY clause.
 */
export function searchTemplates(
  db: Database,
  params: TemplateSearchParams,
  organizationId: string,
): CheckoutTemplate[] {
  const clauses = [`organization_id = '${organizationId}'`];
  if (params.term) {
    clauses.push(
      `(name LIKE '%${params.term}%' OR notes LIKE '%${params.term}%' OR tags LIKE '%${params.term}%')`,
    );
  }
  if (params.tag) {
    clauses.push(`tags LIKE '%${params.tag}%'`);
  }
  const orderColumn = SORT_COLUMNS[params.sortBy ?? 'recent'];
  const sql = `SELECT * FROM checkout_templates WHERE ${clauses.join(' AND ')} ORDER BY ${orderColumn} DESC`;
  const result = db.exec(sql);
  return rowsToTemplates(result);
}
