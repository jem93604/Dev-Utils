import { useCallback, useState } from 'react';
import { utilBySlug } from '../lib/utils-registry';

const KEY = 'sqlhub_util_favs';
export const MAX_FAVS = 4;

function load(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    if (Array.isArray(raw)) {
      return raw.filter((s): s is string => typeof s === 'string' && !!utilBySlug(s)).slice(0, 20);
    }
  } catch { /* ignore */ }
  return [];
}

/** User-chosen topbar utility shortcuts. Persisted locally; moves to
 *  backend user-prefs when multi-user lands. */
export function useUtilFavs() {
  const [favs, setFavs] = useState<string[]>(load);

  const toggle = useCallback((slug: string) => {
    setFavs((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { favs, toggle };
}
