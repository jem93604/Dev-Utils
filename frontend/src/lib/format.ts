// Client-only utilities ported from the HTML: Data Formatter + SQL Differ.

export type FmtKind = 'sql' | 'csv' | 'upper' | 'lower' | 'lines' | 'dedup' | 'count' | 'trim';

export function formatData(raw: string, type: FmtKind): { output: string; note?: string } {
  const items = raw.replace(/\n/g, ',').split(',').map((x) => x.trim()).filter(Boolean);
  switch (type) {
    case 'upper': return { output: items.map((x) => x.toUpperCase()).join('\n') };
    case 'lower': return { output: items.map((x) => x.toLowerCase()).join('\n') };
    case 'csv': return { output: items.join(',') };
    case 'lines': return { output: items.join('\n') };
    case 'dedup': {
      const u = [...new Set(items)];
      return { output: u.join('\n'), note: `${items.length - u.length} duplicates removed` };
    }
    case 'count': return { output: `Total: ${items.length} items` };
    case 'trim': return { output: items.map((x) => x.replace(/\s+/g, ' ').trim()).join('\n') };
    default: return { output: items.map((x) => `'${x}'`).join(',') };
  }
}

export interface DiffLine { kind: 'same' | 'added' | 'removed'; text: string }

export function diffLines(a: string, b: string): DiffLine[] {
  const la = a.split('\n');
  const lb = b.split('\n');
  const out: DiffLine[] = [];
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) {
    const x = la[i];
    const y = lb[i];
    if (x === y) out.push({ kind: 'same', text: x ?? '' });
    else {
      if (x !== undefined) out.push({ kind: 'removed', text: x });
      if (y !== undefined) out.push({ kind: 'added', text: y });
    }
  }
  return out;
}
