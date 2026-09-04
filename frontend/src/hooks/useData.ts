import { useCallback, useEffect, useState } from 'react';
import {
  getNotes, getPins, getQueries, getScripts, getSections, getStats,
  searchApi, togglePinRemote,
  type Note, type NoteSort, type Query, type ScriptItem, type Section, type SearchResults, type Stats,
} from '../lib/api';
import { toast } from '../components/ui';

const EMPTY_STATS: Stats = { sections: 0, queries: 0, pinned: 0, notes: 0, scripts: 0 };
const PINS_EVENT = 'sqlhub:pins-changed';
const CONTENT_EVENT = 'sqlhub:content-changed';

/** Notify every content-aware hook to refetch (after create/update/delete/restore). */
export function notifyContentChanged() {
  window.dispatchEvent(new Event(CONTENT_EVENT));
  window.dispatchEvent(new Event(PINS_EVENT));
}

function useContentListener(load: () => void): void {
  useEffect(() => {
    window.addEventListener(CONTENT_EVENT, load);
    return () => window.removeEventListener(CONTENT_EVENT, load);
  }, [load]);
}

export function useSections() {
  const [data, setData] = useState<Section[]>([]);
  const load = useCallback(() => {
    getSections().then(setData).catch(() => setData([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  useContentListener(load);
  return data;
}

export function useQueries(sectionId: string | undefined) {
  const [data, setData] = useState<Query[]>([]);
  useEffect(() => {
    if (!sectionId) { setData([]); return; }
    let alive = true;
    const load = () => getQueries(sectionId).then((q) => { if (alive) setData(q); }).catch(() => { if (alive) setData([]); });
    load();
    window.addEventListener(PINS_EVENT, load);
    return () => { alive = false; window.removeEventListener(PINS_EVENT, load); };
  }, [sectionId]);
  return data;
}

export function usePins() {
  const [data, setData] = useState<Query[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => getPins().then((p) => { if (alive) setData(p); }).catch(() => { if (alive) setData([]); });
    load();
    window.addEventListener(PINS_EVENT, load);
    return () => { alive = false; window.removeEventListener(PINS_EVENT, load); };
  }, []);
  return data;
}

/** Pin/unpin against the API, then notify all pin-aware hooks to refetch. */
export function useTogglePin() {
  return useCallback(async (q: Query) => {
    try {
      await togglePinRemote(q.id, q.pinned);
      window.dispatchEvent(new Event(PINS_EVENT));
      toast(q.pinned ? 'Unpinned' : '📌 Pinned to Home');
    } catch {
      toast('Pin failed — backend unreachable');
    }
  }, []);
}

export function useStats(): Stats {
  const [data, setData] = useState<Stats>(EMPTY_STATS);
  const load = useCallback(() => {
    getStats().then(setData).catch(() => setData(EMPTY_STATS));
  }, []);
  useEffect(() => { load(); }, [load]);
  useContentListener(load);
  return data;
}

export function useNotes(sort: NoteSort = 'created') {
  const [data, setData] = useState<Note[]>([]);
  useEffect(() => {
    let alive = true;
    getNotes(sort).then((n) => { if (alive) setData(n); }).catch(() => { if (alive) setData([]); });
    return () => { alive = false; };
  }, [sort]);
  return [data, setData] as const;
}

export function useScripts() {
  const [data, setData] = useState<ScriptItem[]>([]);
  useEffect(() => {
    getScripts().then(setData).catch(() => setData([]));
  }, []);
  return [data, setData] as const;
}

/** Debounced API search. Returns null results while idle/empty. */
export function useSearch(term: string, delayMs = 300): { results: SearchResults | null; searching: boolean } {
  const [results, setResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const q = term.trim();
    if (!q) { setResults(null); setSearching(false); return; }
    setSearching(true);
    let alive = true;
    const t = setTimeout(() => {
      searchApi(q)
        .then((r) => { if (alive) { setResults(r); setSearching(false); } })
        .catch(() => { if (alive) { setResults(null); setSearching(false); } });
    }, delayMs);
    return () => { alive = false; clearTimeout(t); };
  }, [term, delayMs]);
  return { results, searching };
}
