// Cron: 5-field parser + next-run calculator + plain-English summary.
// No dependencies; all times evaluated in the browser's local timezone.

export interface CronSchedule {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>; // 0 = Sunday (7 accepted as Sunday too)
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const DOWS: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

function parseValue(raw: string, names: Record<string, number> | null): number {
  const t = raw.trim().toLowerCase();
  if (names && t in names) return names[t];
  if (!/^\d+$/.test(t)) throw new Error(`Bad value "${raw}"`);
  return parseInt(t, 10);
}

function parseField(raw: string, min: number, max: number, names: Record<string, number> | null): Set<number> {
  const out = new Set<number>();
  const parts = raw.split(',');
  if (parts.length === 0) throw new Error('Empty field');
  for (const part of parts) {
    const [range, stepRaw] = part.split('/');
    const step = stepRaw === undefined ? 1 : parseValue(stepRaw, null);
    if (!Number.isInteger(step) || step < 1) throw new Error(`Bad step "${part}"`);
    let lo: number;
    let hi: number;
    if (range === '*') {
      lo = min;
      hi = max;
    } else if (range.includes('-')) {
      const segs = range.split('-');
      if (segs.length !== 2) throw new Error(`Bad range "${part}"`);
      const [a, b] = segs as [string, string];
      if (a === '' || b === '') throw new Error(`Bad range "${part}"`);
      lo = parseValue(a, names);
      hi = parseValue(b, names);
      if (lo > hi) throw new Error(`Reversed range "${part}"`);
    } else {
      lo = parseValue(range, names);
      hi = range === '*' ? max : lo;
    }
    if (lo < min || hi > max) throw new Error(`Out of range "${part}" (${min}-${max})`);
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  if (out.size === 0) throw new Error(`Empty field "${raw}"`);
  return out;
}

export function parseCron(expr: string): CronSchedule {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error('Cron needs exactly 5 fields (minute hour day month weekday)');
  const [mi, hr, dom, mon, dow] = fields as [string, string, string, string, string];
  const sched: CronSchedule = {
    minute: parseField(mi, 0, 59, null),
    hour: parseField(hr, 0, 23, null),
    dom: parseField(dom, 1, 31, null),
    month: parseField(mon, 1, 12, MONTHS),
    dow: parseField(dow, 0, 7, DOWS),
  };
  if (sched.dow.has(7)) {
    sched.dow.delete(7);
    sched.dow.add(0);
  }
  return sched;
}

function matches(s: CronSchedule, d: Date, domRestricted: boolean, dowRestricted: boolean): boolean {
  if (!s.minute.has(d.getMinutes())) return false;
  if (!s.hour.has(d.getHours())) return false;
  if (!s.month.has(d.getMonth() + 1)) return false;
  const domOk = s.dom.has(d.getDate());
  const dowOk = s.dow.has(d.getDay());
  // Standard cron: when both day fields are restricted, either may match.
  if (domRestricted && dowRestricted) return domOk || dowOk;
  if (domRestricted) return domOk;
  if (dowRestricted) return dowOk;
  return true;
}

/** Next `count` run times strictly after `from`. Throws if none found within ~2 years. */
export function nextRuns(expr: string, from: Date, count = 5): Date[] {
  const s = parseCron(expr);
  const domRestricted = s.dom.size < 31;
  const dowRestricted = s.dow.size < 7;
  const out: Date[] = [];
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  const limit = 366 * 2 * 24 * 60;
  for (let i = 0; i < limit && out.length < count; i++) {
    if (matches(s, d, domRestricted, dowRestricted)) out.push(new Date(d.getTime()));
    d.setMinutes(d.getMinutes() + 1);
  }
  if (out.length < count) throw new Error('No runs found in the next 2 years');
  return out;
}

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function fmtTime(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** One-line plain-English summary of a schedule. */
export function describeCron(expr: string): string {
  const s = parseCron(expr);
  const everyMinute = s.minute.size === 60 && s.hour.size === 24 && s.dom.size === 31 && s.month.size === 12 && s.dow.size === 7;
  if (everyMinute) return 'Every minute';
  const bits: string[] = [];
  if (s.minute.size === 1 && s.hour.size === 1) {
    bits.push(`At ${fmtTime([...s.hour][0] as number, [...s.minute][0] as number)}`);
  } else if (s.minute.size < 60) {
    const sorted = [...s.minute].sort((a, b) => a - b);
    const step = sorted.length > 1 ? (sorted[1] as number) - (sorted[0] as number) : 0;
    const even = step > 0 && sorted.every((v, i) => v === (sorted[0] as number) + i * step) && (sorted[0] as number) === 0;
    if (even) bits.push(`Every ${step} minutes`);
    else bits.push(`At minutes ${sorted.join(', ')}`);
  } else {
    bits.push('Every minute');
  }
  if (!(s.minute.size === 1 && s.hour.size === 1)) {
    if (s.hour.size === 1) bits.push(`past hour ${[...s.hour][0]}`);
    else if (s.hour.size < 24) bits.push(`during hours ${[...s.hour].sort((a, b) => a - b).join(', ')}`);
  }
  if (s.dow.size < 7) {
    const days = [...s.dow].sort((a, b) => a - b).map((d) => DOW_NAMES[d] as string);
    const weekdays = s.dow.size === 5 && [1, 2, 3, 4, 5].every((d) => s.dow.has(d));
    bits.push(weekdays ? 'on weekdays' : `on ${days.join(', ')}`);
  } else if (s.dom.size < 31) {
    bits.push(`on days ${[...s.dom].sort((a, b) => a - b).join(', ')} of the month`);
  }
  if (s.month.size < 12) bits.push(`in ${( [...s.month].sort((a, b) => a - b) as number[]).map((m) => MONTH_NAMES[m - 1]).join(', ')}`);
  return bits.join(' ');
}
