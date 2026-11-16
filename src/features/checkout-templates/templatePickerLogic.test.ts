import { describe, expect, it } from 'vitest';
import { allTags } from './TemplatePicker';
import { splitTags } from './SaveTemplateDialog';
import type { CheckoutTemplate } from './db/templateTypes';

function template(tags: string[]): CheckoutTemplate {
  return {
    id: 't1',
    organization_id: 'org-a',
    name: 'Template',
    tags,
    notes: '',
    lines: [],
    created_at: '2026-01-01T00:00:00Z',
    last_used_at: '2026-01-01T00:00:00Z',
  };
}

describe('allTags', () => {
  it('collects the unique tags across templates, sorted', () => {
    const templates = [template(['weekly', 'bulk']), template(['monthly']), template(['bulk'])];
    expect(allTags(templates)).toEqual(['bulk', 'monthly', 'weekly']);
  });

  it('returns an empty list for no templates', () => {
    expect(allTags([])).toEqual([]);
  });
});

describe('splitTags', () => {
  it('splits a comma-separated string and trims whitespace', () => {
    expect(splitTags(' weekly ,  bulk,farmers-market ')).toEqual(['weekly', 'bulk', 'farmers-market']);
  });

  it('drops empty entries from stray commas', () => {
    expect(splitTags('weekly,, bulk,')).toEqual(['weekly', 'bulk']);
  });

  it('returns an empty array for blank input', () => {
    expect(splitTags('')).toEqual([]);
    expect(splitTags('   ')).toEqual([]);
  });
});
