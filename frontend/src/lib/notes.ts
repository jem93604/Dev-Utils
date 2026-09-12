// Pure helpers for the Notes UI (vitest-covered).

/** Collapse whitespace and truncate to a one-line excerpt. */
export function noteExcerpt(content: string, max = 160): string {
  const flat = (content ?? '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return flat.slice(0, max - 1).trimEnd() + '…';
}

/** Relative date for note timestamps ("just now", "5m ago", …), date fallback. */
export function formatNoteDate(iso: string | undefined | null, nowMs = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const diff = nowMs - t;
  if (diff < 0) return new Date(iso).toLocaleDateString();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Word count for the note editor stats line. */
export function noteWordCount(content: string): number {
  return (content ?? '').trim().split(/\s+/).filter(Boolean).length;
}
