// Mock row generator: column defs -> deterministic fake rows (seeded PRNG)
// rendered as INSERT statements or CSV. Pure client-side test data.

export type ColumnType = 'int' | 'uuid' | 'name' | 'email' | 'date' | 'bool' | 'lorem' | 'text';

export interface ColumnDef {
  name: string;
  type: ColumnType;
}

export type RenderFormat = 'insert' | 'csv';

const TYPES: ColumnType[] = ['int', 'uuid', 'name', 'email', 'date', 'bool', 'lorem', 'text'];

function inferType(name: string): ColumnType {
  const n = name.toLowerCase();
  if (/(^|_)id$/.test(n) || n.endsWith('_id') || n === 'id') return 'int';
  if (n.includes('email')) return 'email';
  if (n.includes('name')) return 'name';
  if (n.includes('uuid') || n.includes('guid')) return 'uuid';
  if (n.includes('date') || n.includes('_at') || n.includes('time')) return 'date';
  if (n.startsWith('is_') || n.startsWith('has_') || n.startsWith('allow_')) return 'bool';
  return 'text';
}

/** Parse "name:type, name, ..." — bare names get an inferred type. */
export function parseColumnDefs(input: string): ColumnDef[] {
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) throw new Error('Define at least one column, e.g. "id:int, email"');
  return parts.map((part) => {
    const [rawName, rawType] = part.split(':').map((s) => s.trim());
    if (!rawName || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(rawName)) {
      throw new Error(`Bad column name "${rawName ?? part}"`);
    }
    if (!rawType) return { name: rawName, type: inferType(rawName) };
    const t = rawType.toLowerCase();
    if (!(TYPES as string[]).includes(t)) throw new Error(`Unknown type "${rawType}" (${TYPES.join(', ')})`);
    return { name: rawName, type: t as ColumnType };
  });
}

/** Mulberry32 — small seeded PRNG so output is stable per seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Eli', 'Ivy', 'Omar', 'Nina', 'Kai'];
const LAST = ['Chen', 'Garcia', 'Novak', 'Rossi', 'Kim', 'Weber', 'Ali', 'Silva', 'Berg', 'Costa'];
const WORDS = ['quick', 'ledger', 'harbor', 'signal', 'meadow', 'cipher', 'anchor', 'vista', 'ember', 'grove', 'pixel', 'summit'];

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)] as T;
}

function fakeUuid(r: () => number): string {
  const h = () => Math.floor(r() * 16).toString(16);
  const seg = (n: number) => Array.from({ length: n }, h).join('');
  return `${seg(8)}-${seg(4)}-4${seg(3)}-${pick(r, ['8', '9', 'a', 'b'])}${seg(3)}-${seg(12)}`;
}

function fakeDate(r: () => number): string {
  const base = Date.UTC(2023, 0, 1);
  const span = Date.UTC(2025, 11, 31) - base;
  return new Date(base + Math.floor(r() * span)).toISOString().slice(0, 10);
}

function genValue(type: ColumnType, r: () => number, row: number): string {
  switch (type) {
    case 'int': return String(Math.floor(r() * 10000));
    case 'uuid': return fakeUuid(r);
    case 'name': return `${pick(r, FIRST)} ${pick(r, LAST)}`;
    case 'email': return `${pick(r, FIRST).toLowerCase()}.${pick(r, LAST).toLowerCase()}${row}@example.com`;
    case 'date': return fakeDate(r);
    case 'bool': return r() < 0.5 ? 'true' : 'false';
    case 'lorem': return Array.from({ length: 4 + Math.floor(r() * 5) }, () => pick(r, WORDS)).join(' ');
    case 'text': return Array.from({ length: 2 + Math.floor(r() * 3) }, () => pick(r, WORDS)).join(' ');
  }
}

const RAW = new Set<ColumnType>(['int', 'bool']);

function sqlLiteral(type: ColumnType, v: string): string {
  if (RAW.has(type)) return v;
  return `'${v.replaceAll("'", "''")}'`;
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;
}

export function generateRows(
  cols: ColumnDef[],
  count: number,
  seed: number,
  table = 'my_table',
  format: RenderFormat = 'insert',
): { rows: string[][]; sql: string } {
  const r = rng(seed);
  const rows: string[][] = [];
  for (let i = 0; i < count; i++) {
    rows.push(cols.map((c) => genValue(c.type, r, i + 1)));
  }
  let sql: string;
  if (format === 'csv') {
    sql = [cols.map((c) => c.name).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n');
  } else {
    const names = cols.map((c) => c.name).join(', ');
    sql = rows.length === 0
      ? `-- no rows (count = 0)`
      : `INSERT INTO ${table} (${names}) VALUES\n` +
        rows.map((row) => `(${row.map((v, i) => sqlLiteral((cols[i] as ColumnDef).type, v)).join(', ')})`).join(',\n') +
        ';';
  }
  return { rows, sql };
}
