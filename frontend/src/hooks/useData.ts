import { useCallback, useEffect, useState } from 'react';
import {
  getNotes, getPins, getQueries, getScripts, getSections, getStats,
  togglePinRemote,
  type Note, type Query, type ScriptItem, type Section, type Stats,
} from '../lib/api';
import { toast } from '../components/ui';

const EMPTY_STATS: Stats = { sections: 0, queries: 0, pinned: 0, notes: 0, scripts: 0 };
const PINS_EVENT = 'sqlhub:pins-changed';

export function useSections() {
  const [data, setData] = useState<Section[]>([]);
  useEffect(() => {
    getSections().then(setData).catch(() => setData([]));
  }, []);
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
  useEffect(() => {
    getStats().then(setData).catch(() => setData(EMPTY_STATS));
  }, []);
  return data;
}

export function useNotes() {
  const [data, setData] = useState<Note[]>([]);
  useEffect(() => {
    getNotes().then(setData).catch(() => setData([]));
  }, []);
  return [data, setData] as const;
}

export function useScripts() {
  const [data, setData] = useState<ScriptItem[]>([]);
  useEffect(() => {
    getScripts().then(setData).catch(() => setData([]));
  }, []);
  return [data, setData] as const;
}
