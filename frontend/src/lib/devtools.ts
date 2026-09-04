// Pure client-side helpers for the developer utilities. No backend calls.

/* ---------- Time ---------- */

export interface TimeResult {
  ok: boolean;
  error?: string;
  iso?: string;
  ist?: string;
  utc?: string;
  local?: string;
  epochS?: number;
  epochMs?: number;
  relative?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtTz(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')}`;
}

function relative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const suf = diff >= 0 ? 'ago' : 'from now';
  const m = Math.floor(abs / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ${suf}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ${suf}`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ${suf}`;
  return `${Math.floor(days / 30)}mo ${suf}`;
}

export function parseTimeInput(raw: string): TimeResult {
  const s = raw.trim();
  if (!s) return { ok: false, error: 'Enter an epoch or date string' };
  let d: Date | null = null;
  if (/^-?\d+$/.test(s)) {
    // 10 digits (or fewer) = seconds, longer = milliseconds
    const n = Number(s);
    d = new Date(s.length > 10 ? n : n * 1000);
  } else {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) d = new Date(t);
  }
  if (!d || Number.isNaN(d.getTime())) return { ok: false, error: 'Unrecognized date/epoch' };
  return {
    ok: true,
    iso: d.toISOString(),
    ist: fmtTz(d, 'Asia/Kolkata') + ' IST',
    utc: fmtTz(d, 'UTC') + ' UTC',
    local: d.toLocaleString(),
    epochS: Math.floor(d.getTime() / 1000),
    epochMs: d.getTime(),
    relative: relative(d),
  };
}

export function pgTimeSnippets(epochS: number): string {
  return `SELECT to_timestamp(${epochS}) AT TIME ZONE 'UTC' AS utc,\n       to_timestamp(${epochS}) AT TIME ZONE 'Asia/Kolkata' AS ist;`;
}

export function monthName(m: number): string {
  return MONTHS[m] ?? '';
}

export function pad2(n: number): string {
  return pad(n);
}

/* ---------- Codec (Unicode-safe Base64 + URL) ---------- */

export function b64encode(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

export function b64decode(s: string): string {
  const bin = atob(s.trim());
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/* ---------- JWT (decode only, no verification) ---------- */

export interface JwtResult {
  ok: boolean;
  error?: string;
  header?: unknown;
  payload?: unknown;
  expired?: boolean;
  expiresAt?: string;
}

function b64url(s: string): string {
  return b64decode(s.replace(/-/g, '+').replace(/_/g, '/'));
}

export function decodeJwt(token: string): JwtResult {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return { ok: false, error: 'Expected header.payload.signature' };
  try {
    const header = JSON.parse(b64url(parts[0]));
    const payload = JSON.parse(b64url(parts[1])) as Record<string, unknown>;
    let expired: boolean | undefined;
    let expiresAt: string | undefined;
    if (typeof payload.exp === 'number') {
      const d = new Date(payload.exp * 1000);
      expiresAt = d.toISOString();
      expired = d.getTime() < Date.now();
    }
    return { ok: true, header, payload, expired, expiresAt };
  } catch {
    return { ok: false, error: 'Invalid Base64/JSON in token' };
  }
}

/* ---------- UUID ---------- */

export type UuidFormat = 'dashes' | 'plain' | 'upper';

export function genUuids(count: number, format: UuidFormat): string[] {
  const n = Math.min(Math.max(1, count), 200);
  return Array.from({ length: n }, () => {
    const u = crypto.randomUUID();
    if (format === 'plain') return u.replace(/-/g, '');
    if (format === 'upper') return u.toUpperCase();
    return u;
  });
}

/* ---------- Number bases ---------- */

export interface BaseResult {
  dec: string; hex: string; bin: string; oct: string; error?: string;
}

export function convertBase(value: string, from: 'dec' | 'hex' | 'bin' | 'oct'): BaseResult {
  const empty: BaseResult = { dec: '', hex: '', bin: '', oct: '' };
  const s = value.trim().toLowerCase().replace(/^0x/, '');
  if (!s) return empty;
  const radix = from === 'dec' ? 10 : from === 'hex' ? 16 : from === 'bin' ? 2 : 8;
  const digits = from === 'hex' ? '0-9a-f' : from === 'bin' ? '01' : from === 'oct' ? '0-7' : '0-9';
  if (!new RegExp(`^[+-]?[${digits}]+$`, 'i').test(s)) {
    return { ...empty, error: `Not a valid base-${radix} number` };
  }
  const num = parseInt(s, radix);
  if (Number.isNaN(num)) return { ...empty, error: `Not a valid base-${radix} number` };
  return {
    dec: String(num),
    hex: '0x' + num.toString(16).toUpperCase(),
    bin: '0b' + num.toString(2),
    oct: '0o' + num.toString(8),
  };
}

/* ---------- Text toolkit ---------- */

export interface TextStats {
  chars: number; words: number; lines: number;
}

export function textStats(s: string): TextStats {
  return {
    chars: s.length,
    words: (s.trim().match(/\S+/g) ?? []).length,
    lines: s === '' ? 0 : s.split('\n').length,
  };
}

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

export function lorem(paragraphs: number): string {
  return Array.from({ length: Math.min(Math.max(1, paragraphs), 10) }, () => LOREM).join('\n\n');
}

export function cleanWhitespace(s: string): string {
  return s.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
