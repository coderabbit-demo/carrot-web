import { useCallback, useEffect, useRef, useState } from 'react';
import type { Database } from 'sql.js';
import { isEqual } from 'lodash-es';
import { useAuth } from '../auth/AuthProvider';
import { initTemplateDb, persistTemplateDb } from './db/templateDb';
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  searchTemplates,
  touchTemplate,
} from './db/templateQueries';
import type {
  CheckoutTemplate,
  CreateTemplateInput,
  TemplateSearchParams,
} from './db/templateTypes';

export interface UseCheckoutTemplates {
  templates: CheckoutTemplate[];
  loading: boolean;
  error: string | null;
  search(params: TemplateSearchParams): void;
  save(input: CreateTemplateInput): CheckoutTemplate | null;
  remove(id: string): void;
  markUsed(id: string): void;
  reload(): void;
}

/**
 * Wraps the sql.js-backed template store for components: opens (or creates) the database once
 * per organization, exposes CRUD and search, and persists after every mutation so the next page
 * load sees the same templates.
 */
export function useCheckoutTemplates(): UseCheckoutTemplates {
  const { organization } = useAuth();
  const organizationId = organization?.id ?? null;
  const dbRef = useRef<Database | null>(null);
  const [templates, setTemplates] = useState<CheckoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSearch, setLastSearch] = useState<TemplateSearchParams>({ sortBy: 'recent' });

  useEffect(() => {
    let cancelled = false;
    if (!organizationId) {
      setTemplates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    initTemplateDb()
      .then((db) => {
        if (cancelled) return;
        dbRef.current = db;
        setTemplates(listTemplates(db, organizationId));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not open the saved-templates database in this browser.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const withDb = useCallback(
    <T,>(fn: (db: Database, organizationId: string) => T): T | null => {
      if (!dbRef.current || !organizationId) return null;
      return fn(dbRef.current, organizationId);
    },
    [organizationId],
  );

  const search = useCallback(
    (params: TemplateSearchParams) => {
      if (isEqual(params, lastSearch)) return;
      setLastSearch(params);
      const result = withDb((db, orgId) => searchTemplates(db, params, orgId));
      if (result) setTemplates(result);
    },
    [withDb, lastSearch],
  );

  const reload = useCallback(() => {
    const result = withDb((db, orgId) => searchTemplates(db, lastSearch, orgId));
    if (result) setTemplates(result);
  }, [withDb, lastSearch]);

  const save = useCallback(
    (input: CreateTemplateInput): CheckoutTemplate | null => {
      const created = withDb((db, orgId) => {
        const template = createTemplate(db, orgId, input);
        persistTemplateDb(db);
        return template;
      });
      if (created) reload();
      return created;
    },
    [withDb, reload],
  );

  const remove = useCallback(
    (id: string) => {
      withDb((db, orgId) => {
        deleteTemplate(db, id, orgId);
        persistTemplateDb(db);
        return null;
      });
      reload();
    },
    [withDb, reload],
  );

  const markUsed = useCallback(
    (id: string) => {
      withDb((db, orgId) => {
        touchTemplate(db, id, orgId);
        persistTemplateDb(db);
        return null;
      });
      reload();
    },
    [withDb, reload],
  );

  return { templates, loading, error, search, save, remove, markUsed, reload };
}
