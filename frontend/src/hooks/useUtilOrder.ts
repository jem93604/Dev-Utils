import { useCallback } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import { NO_SYNC, useSyncedStringList, type SyncConfig } from './useSyncedList';

const KEY = 'sqlhub_util_order';
const PREF = 'util_order';

/** Merge a stored slug order with the registry: unknown slugs dropped,
 *  newly added utils appended in registry order. Pure (tested). */
export function orderUtilSlugs(known: string[], stored: string[]): string[] {
  const knownSet = new Set(known);
  const ordered = stored.filter((s) => knownSet.has(s));
  for (const s of known) {
    if (!ordered.includes(s)) ordered.push(s);
  }
  return ordered;
}

/** Hub card order. Local-first, synced to user_prefs across devices
 *  whenever sync applies. */
export function useUtilOrder(known: string[], sync: SyncConfig = NO_SYNC) {
  const validate = useCallback((v: string[]) => orderUtilSlugs(known, v), [known]);
  const { list: stored, update } = useSyncedStringList(KEY, PREF, validate, sync);
  const order = orderUtilSlugs(known, stored);

  const move = useCallback((activeId: string, overId: string) => {
    update((prev) => {
      const cur = orderUtilSlugs(known, prev);
      const from = cur.indexOf(activeId);
      const to = cur.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return prev;
      return arrayMove(cur, from, to);
    });
  }, [known, update]);

  return { order, move };
}
