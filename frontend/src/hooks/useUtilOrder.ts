import { useCallback, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';

const KEY = 'sqlhub_util_order';

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

function load(known: string[]): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (Array.isArray(raw)) {
      return orderUtilSlugs(
        known,
        raw.filter((s): s is string => typeof s === 'string'),
      );
    }
  } catch { /* ignore */ }
  return [...known];
}

/** Hub card order. Persisted locally; backend user-prefs when multi-user lands. */
export function useUtilOrder(known: string[]) {
  const [order, setOrder] = useState<string[]>(() => load(known));
  const merged = orderUtilSlugs(known, order);

  const move = useCallback((activeId: string, overId: string) => {
    setOrder((prev) => {
      const cur = orderUtilSlugs(known, prev);
      const from = cur.indexOf(activeId);
      const to = cur.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = arrayMove(cur, from, to);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, [known]);

  return { order: merged, move };
}
