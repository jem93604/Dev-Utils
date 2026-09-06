import { useCallback } from 'react';
import { utilBySlug } from '../lib/utils-registry';
import { NO_SYNC, useSyncedStringList, type SyncConfig } from './useSyncedList';

const KEY = 'sqlhub_util_favs';
const PREF = 'util_favs';
export const MAX_FAVS = 4;

function validate(favs: string[]): string[] {
  return favs.filter((s) => !!utilBySlug(s)).slice(0, 20);
}

/** User-chosen topbar utility shortcuts. Local-first, synced to user_prefs
 *  across devices whenever sync applies. */
export function useUtilFavs(sync: SyncConfig = NO_SYNC) {
  const { list: favs, update } = useSyncedStringList(KEY, PREF, validate, sync);

  const toggle = useCallback((slug: string) => {
    update((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }, [update]);

  return { favs, toggle };
}
