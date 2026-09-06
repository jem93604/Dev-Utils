// Connection-string parser: Postgres + SQLite URLs -> labeled fields.
// The password value is NEVER returned — only whether one is set.

export type ConnKind = 'postgres' | 'sqlite';

export interface ConnInfo {
  kind: ConnKind;
  scheme: string;
  user: string;
  hasPassword: boolean;
  host: string;
  port: number | null;
  database: string;
  params: Record<string, string>;
}

export function parseConnStr(input: string): ConnInfo {
  const raw = input.trim();
  if (!raw) throw new Error('Empty connection string');
  if (/\s/.test(raw)) throw new Error('Connection string must not contain spaces');

  const schemeEnd = raw.indexOf('://');
  if (schemeEnd === -1) throw new Error('Missing scheme (e.g. postgresql:// or sqlite://)');
  const scheme = raw.slice(0, schemeEnd).toLowerCase();
  const rest = raw.slice(schemeEnd + 3);

  if (scheme === 'sqlite') {
    if (!rest) throw new Error('SQLite URL needs a path (e.g. sqlite:///./app.db)');
    // sqlite:///./rel.db -> ./rel.db ; sqlite:////abs.db -> /abs.db
    const database = rest.startsWith('//') ? rest.slice(1) : rest.replace(/^\//, '');
    return { kind: 'sqlite', scheme, user: '', hasPassword: false, host: '', port: null, database, params: {} };
  }
  if (scheme !== 'postgres' && scheme !== 'postgresql') {
    throw new Error(`Unsupported scheme "${scheme}" (postgres, postgresql, sqlite)`);
  }

  // Split off query params first.
  const q = rest.indexOf('?');
  const authority = q === -1 ? rest : rest.slice(0, q);
  const query = q === -1 ? '' : rest.slice(q + 1);
  const params: Record<string, string> = {};
  if (query) {
    for (const pair of query.split('&')) {
      const eq = pair.indexOf('=');
      params[decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq))] =
        decodeURIComponent(eq === -1 ? '' : pair.slice(eq + 1));
    }
  }

  // authority: [user[:password]@]host[:port]/database
  const slash = authority.indexOf('/');
  if (slash === -1) throw new Error('Missing database name after host');
  const hostPart = authority.slice(0, slash);
  const database = authority.slice(slash + 1);
  if (!hostPart || !database) throw new Error('Need host and database (…@host/db)');

  let user = '';
  let hasPassword = false;
  let hostPort = hostPart;
  const at = hostPart.lastIndexOf('@');
  if (at !== -1) {
    const creds = hostPart.slice(0, at);
    hostPort = hostPart.slice(at + 1);
    const colon = creds.indexOf(':');
    user = decodeURIComponent(colon === -1 ? creds : creds.slice(0, colon));
    hasPassword = colon !== -1;
  }
  let host = hostPort;
  let port: number | null = 5432;
  const colon = hostPort.lastIndexOf(':');
  if (colon !== -1) {
    host = hostPort.slice(0, colon);
    const p = Number(hostPort.slice(colon + 1));
    if (!Number.isInteger(p) || p < 1 || p > 65535) throw new Error(`Bad port "${hostPort.slice(colon + 1)}"`);
    port = p;
  }
  if (!host) throw new Error('Missing host');
  return { kind: 'postgres', scheme, user, hasPassword, host, port, database, params };
}
