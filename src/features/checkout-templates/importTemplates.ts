import { z } from 'zod';
import type { Database } from 'sql.js';
import { createTemplate } from './db/templateQueries';
import { persistTemplateDb } from './db/templateDb';
import type { CheckoutTemplate } from './db/templateTypes';

const TemplateLineSchema = z.object({
  product_id: z.string().min(1),
  quantity_kg: z.number().int().positive(),
});

export const TemplateImportSchema = z.object({
  name: z.string().min(1).max(120),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(2000).default(''),
  lines: z.array(TemplateLineSchema).min(1),
});

export type TemplateImportEntry = z.infer<typeof TemplateImportSchema>;

export interface SkippedImportEntry {
  index: number;
  reason: string;
}

export interface ImportTemplatesResult {
  imported: CheckoutTemplate[];
  skipped: SkippedImportEntry[];
}

interface ParsedImportFile {
  entries: TemplateImportEntry[];
  skipped: SkippedImportEntry[];
}

/** Parses an uploaded template export file's text, keeping only the well-formed entries. */
export function parseTemplateImportFile(fileText: string): ParsedImportFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    return { entries: [], skipped: [{ index: -1, reason: 'The file is not valid JSON.' }] };
  }
  const rawList: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { templates?: unknown[] })?.templates)
      ? (parsed as { templates: unknown[] }).templates
      : [];

  const entries: TemplateImportEntry[] = [];
  const skipped: SkippedImportEntry[] = [];
  rawList.forEach((candidate, index) => {
    const result = TemplateImportSchema.safeParse(candidate);
    if (result.success) {
      entries.push(result.data);
    } else {
      skipped.push({ index, reason: result.error.issues[0]?.message ?? 'Does not match the expected shape.' });
    }
  });
  return { entries, skipped };
}

/**
 * Validates an uploaded JSON file's entries with `TemplateImportSchema` and creates a template
 * for each valid one, collecting a summary of anything skipped.
 */
export function importTemplates(
  db: Database,
  organizationId: string,
  fileText: string,
): ImportTemplatesResult {
  const { entries, skipped } = parseTemplateImportFile(fileText);
  const imported = entries.map((entry) =>
    createTemplate(db, organizationId, {
      name: entry.name,
      tags: entry.tags,
      notes: entry.notes,
      lines: entry.lines,
    }),
  );
  if (imported.length > 0) persistTemplateDb(db);
  return { imported, skipped };
}
