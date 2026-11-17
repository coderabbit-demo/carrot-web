import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { CHECKOUT_TEMPLATES_SCHEMA } from './schema';

const STORAGE_KEY = 'carrot_checkout_templates_db';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function readStoredBytes(): Uint8Array | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return base64ToBytes(raw);
  } catch {
    // Missing, blocked, or not valid base64: treated the same as "no database yet".
    return null;
  }
}

/**
 * Creates or loads the templates database. Loads existing bytes from `localStorage` when
 * present and well-formed; otherwise starts a fresh, empty database. A corrupt blob never
 * throws here, it just falls back to a fresh database, matching this repo's convention for
 * localStorage reads (see `AuthProvider`'s stored-organization handling).
 */
export async function initTemplateDb(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`,
  });

  const existingBytes = readStoredBytes();
  let db: Database;
  if (existingBytes) {
    try {
      db = new SQL.Database(existingBytes);
      // A blob that loaded but isn't actually our schema (or is from an older version) still
      // needs the table to exist; CREATE TABLE IF NOT EXISTS is a no-op when it already does.
      db.run(CHECKOUT_TEMPLATES_SCHEMA);
    } catch {
      db = new SQL.Database();
      db.run(CHECKOUT_TEMPLATES_SCHEMA);
    }
  } else {
    db = new SQL.Database();
    db.run(CHECKOUT_TEMPLATES_SCHEMA);
  }
  return db;
}

/** Exports the database to bytes and writes them back to `localStorage` as base64. */
export function persistTemplateDb(db: Database): void {
  try {
    const bytes = db.export();
    localStorage.setItem(STORAGE_KEY, bytesToBase64(bytes));
  } catch {
    // Storage full or blocked: the in-memory database still works for this page load.
  }
}
