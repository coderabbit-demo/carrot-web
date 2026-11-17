import { describe, expect, it } from 'vitest';
import { parseTemplateImportFile, TemplateImportSchema } from './importTemplates';

const VALID_ENTRY = {
  name: 'Weekly carrots',
  tags: ['weekly'],
  notes: 'For the market stall',
  lines: [{ product_id: 'carrots', quantity_kg: 50 }],
};

describe('TemplateImportSchema', () => {
  it('accepts a well-formed entry', () => {
    expect(TemplateImportSchema.safeParse(VALID_ENTRY).success).toBe(true);
  });

  it('defaults missing tags and notes', () => {
    const result = TemplateImportSchema.safeParse({
      name: 'No tags',
      lines: [{ product_id: 'p1', quantity_kg: 1 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
      expect(result.data.notes).toBe('');
    }
  });

  it('rejects an entry with no name', () => {
    expect(TemplateImportSchema.safeParse({ ...VALID_ENTRY, name: '' }).success).toBe(false);
  });

  it('rejects an entry with no lines', () => {
    expect(TemplateImportSchema.safeParse({ ...VALID_ENTRY, lines: [] }).success).toBe(false);
  });

  it('rejects a line with a non-integer quantity', () => {
    expect(
      TemplateImportSchema.safeParse({
        ...VALID_ENTRY,
        lines: [{ product_id: 'p1', quantity_kg: 2.5 }],
      }).success,
    ).toBe(false);
  });

  it('rejects a line with a non-positive quantity', () => {
    expect(
      TemplateImportSchema.safeParse({
        ...VALID_ENTRY,
        lines: [{ product_id: 'p1', quantity_kg: 0 }],
      }).success,
    ).toBe(false);
  });

  it('rejects a line missing a product id', () => {
    expect(
      TemplateImportSchema.safeParse({
        ...VALID_ENTRY,
        lines: [{ quantity_kg: 1 }],
      }).success,
    ).toBe(false);
  });
});

describe('parseTemplateImportFile', () => {
  it('parses an export-shaped file with a top-level templates array', () => {
    const file = JSON.stringify({ exported_at: '2026-01-01T00:00:00Z', templates: [VALID_ENTRY] });
    const { entries, skipped } = parseTemplateImportFile(file);
    expect(entries).toHaveLength(1);
    expect(skipped).toHaveLength(0);
  });

  it('parses a bare array of entries', () => {
    const file = JSON.stringify([VALID_ENTRY, VALID_ENTRY]);
    const { entries, skipped } = parseTemplateImportFile(file);
    expect(entries).toHaveLength(2);
    expect(skipped).toHaveLength(0);
  });

  it('keeps valid entries and collects invalid ones separately', () => {
    const file = JSON.stringify([VALID_ENTRY, { name: '', lines: [] }]);
    const { entries, skipped } = parseTemplateImportFile(file);
    expect(entries).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].index).toBe(1);
  });

  it('reports invalid JSON as a single skip rather than throwing', () => {
    const { entries, skipped } = parseTemplateImportFile('not json');
    expect(entries).toHaveLength(0);
    expect(skipped).toHaveLength(1);
  });

  it('treats an object with neither shape as an empty import', () => {
    const { entries, skipped } = parseTemplateImportFile(JSON.stringify({ foo: 'bar' }));
    expect(entries).toHaveLength(0);
    expect(skipped).toHaveLength(0);
  });
});
