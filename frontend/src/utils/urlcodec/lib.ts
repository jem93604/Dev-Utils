// URL codec: component/full encode-decode plus query-string split/rebuild.

export interface QueryParam {
  key: string;
  value: string;
}

export function encodeComponent(s: string): string {
  return encodeURIComponent(s);
}

export function decodeComponent(s: string): string {
  if (/%(?![0-9A-Fa-f]{2})/.test(s)) throw new Error('Malformed %-escape');
  return decodeURIComponent(s);
}

export function encodeUrlFull(s: string): string {
  return encodeURI(s);
}

/** Split into base + decoded params. Accepts full URLs or bare query strings. */
export function splitUrl(input: string): { base: string; params: QueryParam[] } {
  const raw = input.trim();
  if (raw === '') throw new Error('Empty input');
  if (/\s/.test(raw)) throw new Error('URL must not contain spaces — encode it first');
  const q = raw.indexOf('?');
  const base = q === -1 ? raw : raw.slice(0, q);
  let query = q === -1 ? '' : raw.slice(q + 1);
  if (q === -1 && !raw.includes('=') && !raw.includes('&')) {
    // No query part at all: validate it parses as a URL or path.
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:|^[/.#]?[\w~:/?#[\]@!$&'()*+,;=%.-]*$/.test(raw)) {
      throw new Error('Not a URL or query string');
    }
    return { base: raw, params: [] };
  }
  if (q === -1) {
    query = raw;
    return { base: '', params: parseQuery(query) };
  }
  return { base, params: parseQuery(query) };
}

function parseQuery(query: string): QueryParam[] {
  if (query === '') return [];
  return query.split('&').map((pair) => {
    const eq = pair.indexOf('=');
    const k = eq === -1 ? pair : pair.slice(0, eq);
    const v = eq === -1 ? '' : pair.slice(eq + 1);
    try {
      return { key: decodeComponent(k.replaceAll('+', ' ')), value: decodeComponent(v.replaceAll('+', ' ')) };
    } catch {
      throw new Error(`Bad param "${pair}"`);
    }
  });
}

export function buildUrl(base: string, params: QueryParam[]): string {
  if (params.length === 0) return base;
  const q = params.map((p) => `${encodeComponent(p.key)}=${encodeComponent(p.value)}`).join('&');
  return `${base}?${q}`;
}
