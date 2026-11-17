import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLastUser, readLastUser } from './SignInPage';

function stubLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
  return store;
}

describe('readLastUser', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = stubLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the greeting when a valid entry is stored', () => {
    store.set('carrot_last_user', JSON.stringify({ name: 'Jane', email: 'jane@example.com' }));
    expect(readLastUser()).toEqual({ name: 'Jane', email: 'jane@example.com' });
  });

  it('returns null when nothing is stored', () => {
    expect(readLastUser()).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    store.set('carrot_last_user', '{not json');
    expect(readLastUser()).toBeNull();
  });

  it('returns null when the stored shape is missing fields', () => {
    store.set('carrot_last_user', JSON.stringify({ name: 'Jane' }));
    expect(readLastUser()).toBeNull();
  });

  it('clearLastUser removes the stored entry', () => {
    store.set('carrot_last_user', JSON.stringify({ name: 'Jane', email: 'jane@example.com' }));
    clearLastUser();
    expect(readLastUser()).toBeNull();
  });
});
