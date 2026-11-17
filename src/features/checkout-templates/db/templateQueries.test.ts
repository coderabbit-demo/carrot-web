// These tests exercise `templateQueries` against a real in-memory sql.js database (`new SQL.Database()`
// with no persisted bytes). They were written to the sql.js API as documented but were not run in this
// environment, since installing packages was out of scope for this change; see the PR description.
import { describe, expect, it, beforeEach } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { CHECKOUT_TEMPLATES_SCHEMA } from './schema';
import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  listTemplates,
  searchTemplates,
  touchTemplate,
  updateTemplate,
} from './templateQueries';

async function freshDb(): Promise<Database> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(CHECKOUT_TEMPLATES_SCHEMA);
  return db;
}

describe('templateQueries CRUD', () => {
  let db: Database;
  const ORG_A = 'org-a';
  const ORG_B = 'org-b';

  beforeEach(async () => {
    db = await freshDb();
  });

  it('creates and reads back a template', () => {
    const created = createTemplate(db, ORG_A, {
      name: 'Weekly standing order',
      tags: ['weekly', 'standing'],
      notes: 'Deliver to loading dock B',
      lines: [{ product_id: 'p1', quantity_kg: 20 }],
    });

    expect(created.id).toBeTruthy();
    expect(created.organization_id).toBe(ORG_A);

    const fetched = getTemplateById(db, created.id, ORG_A);
    expect(fetched).toEqual(created);
  });

  it('never returns a template from another organization', () => {
    const created = createTemplate(db, ORG_A, {
      name: 'Org A template',
      tags: [],
      notes: '',
      lines: [{ product_id: 'p1', quantity_kg: 1 }],
    });

    expect(getTemplateById(db, created.id, ORG_B)).toBeNull();
    expect(listTemplates(db, ORG_B)).toEqual([]);
  });

  it('updates the fields given in the patch and leaves the rest untouched', () => {
    const created = createTemplate(db, ORG_A, {
      name: 'Original name',
      tags: ['a'],
      notes: 'original notes',
      lines: [{ product_id: 'p1', quantity_kg: 1 }],
    });

    updateTemplate(db, created.id, ORG_A, { name: 'Renamed', tags: ['a', 'b'] });

    const updated = getTemplateById(db, created.id, ORG_A);
    expect(updated?.name).toBe('Renamed');
    expect(updated?.tags).toEqual(['a', 'b']);
    expect(updated?.notes).toBe('original notes');
  });

  it('does not update a template scoped to a different organization', () => {
    const created = createTemplate(db, ORG_A, {
      name: 'Org A template',
      tags: [],
      notes: '',
      lines: [],
    });

    updateTemplate(db, created.id, ORG_B, { name: 'Hijacked' });

    expect(getTemplateById(db, created.id, ORG_A)?.name).toBe('Org A template');
  });

  it('bumps last_used_at on touch', () => {
    const created = createTemplate(db, ORG_A, {
      name: 'Touch me',
      tags: [],
      notes: '',
      lines: [],
    });
    const before = created.last_used_at;

    touchTemplate(db, created.id, ORG_A);

    const after = getTemplateById(db, created.id, ORG_A);
    expect(after?.last_used_at >= before).toBe(true);
  });

  it('deletes a template only for the matching organization', () => {
    const created = createTemplate(db, ORG_A, { name: 'Delete me', tags: [], notes: '', lines: [] });

    deleteTemplate(db, created.id, ORG_B);
    expect(getTemplateById(db, created.id, ORG_A)).not.toBeNull();

    deleteTemplate(db, created.id, ORG_A);
    expect(getTemplateById(db, created.id, ORG_A)).toBeNull();
  });

  it('lists templates for one organization ordered by last used, most recent first', () => {
    const older = createTemplate(db, ORG_A, { name: 'Older', tags: [], notes: '', lines: [] });
    const newer = createTemplate(db, ORG_A, { name: 'Newer', tags: [], notes: '', lines: [] });
    touchTemplate(db, newer.id, ORG_A);

    const list = listTemplates(db, ORG_A);
    expect(list.map((t) => t.id)).toEqual([newer.id, older.id]);
  });
});

describe('searchTemplates', () => {
  let db: Database;
  const ORG_A = 'org-a';

  beforeEach(async () => {
    db = await freshDb();
    createTemplate(db, ORG_A, {
      name: 'Weekly carrots',
      tags: ['weekly', 'farmers-market'],
      notes: 'Standing order for the market stall',
      lines: [{ product_id: 'carrots', quantity_kg: 50 }],
    });
    createTemplate(db, ORG_A, {
      name: 'Monthly bulk buy',
      tags: ['monthly', 'bulk'],
      notes: 'Large restock',
      lines: [{ product_id: 'carrots', quantity_kg: 500 }],
    });
  });

  it('matches by name, note, or tag substring', () => {
    expect(searchTemplates(db, { term: 'weekly' }, ORG_A).map((t) => t.name)).toEqual(['Weekly carrots']);
    expect(searchTemplates(db, { term: 'restock' }, ORG_A).map((t) => t.name)).toEqual(['Monthly bulk buy']);
  });

  it('filters by tag', () => {
    expect(searchTemplates(db, { tag: 'bulk' }, ORG_A).map((t) => t.name)).toEqual(['Monthly bulk buy']);
  });

  it('sorts by name when asked', () => {
    const names = searchTemplates(db, { sortBy: 'name' }, ORG_A).map((t) => t.name);
    expect(names).toEqual(['Weekly carrots', 'Monthly bulk buy']);
  });

  it('builds the expected SQL text for an ordinary search term', () => {
    const originalExec = db.exec.bind(db);
    let capturedSql = '';
    db.exec = ((sql: string) => {
      capturedSql = sql;
      return originalExec(sql);
    }) as typeof db.exec;

    searchTemplates(db, { term: 'carrots', sortBy: 'created' }, ORG_A);

    expect(capturedSql).toContain("LIKE '%carrots%'");
    expect(capturedSql).toContain('ORDER BY created_at DESC');
  });

  it('scopes results to the given organization only', () => {
    createTemplate(db, 'org-b', {
      name: 'Other org weekly order',
      tags: ['weekly'],
      notes: '',
      lines: [],
    });
    expect(searchTemplates(db, { term: 'weekly' }, ORG_A).map((t) => t.name)).toEqual(['Weekly carrots']);
  });
});
