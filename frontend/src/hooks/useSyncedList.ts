import { useCallback, useEffect, useRef, useState } from 'react';
import { getPrefs, setPref } from '../lib/api';

export interface SyncConfig {
  /** Identity of the viewer: user id, 'local' in single-user mode, null when logged out. */
  userKey: string | null;
  /** False while logged out with auth on (server would 401) — local only. */
  canSync: boolean;
}

export const NO_SYNC: SyncConfig = { userKey: null, canSync: false };

/** Merge rule: a stored server value wins; a missing or empty server key
 *  adopts local (first sync, pushed up). Pure (tested). */
export function resolveSyncedList(
  local: string[],
  server: string[] | undefined,
): { value: string[]; pushUp: boolean } {
  if (server !== undefined && server.length > 0) return { value: server, pushUp: false };
  if (local.length > 0) return { value: local, pushUp: true };
  return { value: [], pushUp: false };
}

function loadLocal(key: string, validate: (v: string[]) => string[]): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]') as unknown;
    if (Array.isArray(raw)) return validate(raw.filter((s): s is string => typeof s === 'string'));
  } catch { /* ignore */ }
  return validate([]);
}

function saveLocal(key: string, value: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}

/** String list persisted to localStorage immediately and to user_prefs
 *  (debounced) whenever sync applies. Reloads when identity changes. */
export function useSyncedStringList(
  localKey: string,
  prefKey: string,
  validate: (v: string[]) => string[],
  sync: SyncConfig = NO_SYNC,
) {
  const [list, setList] = useState<string[]>(() => loadLocal(localKey, validate));
  const listRef = useRef(list);
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const timer = useRef<number | undefined>(undefined);

  const apply = useCallback((value: string[]) => {
    listRef.current = value;
    setList(value);
    saveLocal(localKey, value);
    if (syncRef.current.canSync) {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        setPref(prefKey, value).catch(() => { /* offline: local copy stays */ });
      }, 500);
    }
  }, [localKey, prefKey]);

  // Pull server state whenever identity changes (login/logout/single-user boot).
  useEffect(() => {
    let cancelled = false;
    if (!sync.canSync || !sync.userKey) {
      apply(loadLocal(localKey, validate));
      return;
    }
    getPrefs()
      .then((prefs) => {
        if (cancelled) return;
        const raw = prefs[prefKey];
        const server = Array.isArray(raw) ? validate(raw.filter((s) => typeof s === 'string')) : undefined;
        const { value, pushUp } = resolveSyncedList(loadLocal(localKey, validate), server);
        apply(value);
        if (pushUp) setPref(prefKey, value).catch(() => {});
      })
      .catch(() => {
        if (!cancelled) apply(loadLocal(localKey, validate));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.userKey, sync.canSync]);

  const update = useCallback((fn: (prev: string[]) => string[]) => {
    apply(validate(fn(listRef.current)));
  }, [apply, validate]);

  return { list, update };
}
