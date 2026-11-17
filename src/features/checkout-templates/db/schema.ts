/**
 * DDL for the client-side saved-checkout-templates store. Runs once when a fresh (or
 * unreadable) database is created; existing databases loaded from storage already have it.
 */
export const CHECKOUT_TEMPLATES_SCHEMA = `
CREATE TABLE IF NOT EXISTS checkout_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  lines_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkout_templates_organization_id
  ON checkout_templates (organization_id);
`;
