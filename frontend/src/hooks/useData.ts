import { useEffect, useState } from 'react';
import {
  getNotes, getPins, getQueries, getScripts, getSections, getStats,
  type Note, type Query, type ScriptItem, type Section, type Stats,
} from '../lib/api';

const EMPTY_STATS: Stats = { sections: 0, queries: 0, pinned: 0, notes: 0, scripts: 0 };

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
    getQueries(sectionId).then(setData).catch(() => setData([]));
  }, [sectionId]);
  return data;
}

export function usePins() {
  const [data, setData] = useState<Query[]>([]);
  useEffect(() => {
    getPins().then(setData).catch(() => setData([]));
  }, []);
  return data;
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
