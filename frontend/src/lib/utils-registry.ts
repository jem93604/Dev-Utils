// Utility registry — the ONLY place that lists utilities.
// To add a utility:
//   1) append one row here { slug, title, icon, description, route }
//   2) add its <Route> in App.tsx + panel component
// The hub page, sidebar, topbar favorites, and Ctrl+K palette all render
// from this list automatically. No other file needs touching.

export interface UtilDef {
  slug: string;
  title: string;
  icon: string;
  description: string;
  route: string;
}

export const UTILS: UtilDef[] = [
  { slug: 'formatter', title: 'Data Formatter', icon: '🛠', description: 'Lists to SQL IN(...), CSV, UPPER/lower, dedup', route: '/formatter' },
  { slug: 'differ', title: 'SQL Differ', icon: '🔄', description: 'Line-by-line diff of two queries', route: '/differ' },
  { slug: 'notes', title: 'Notes & Snippets', icon: '📝', description: 'Sticky notes stored in the database', route: '/notes' },
  { slug: 'library', title: 'Script Library', icon: '📂', description: 'Server script paths with purpose + steps', route: '/library' },
  { slug: 'time', title: 'Time Converter', icon: '🕒', description: 'Epoch ↔ date, IST/UTC/local, Postgres snippets', route: '/utils/time' },
  { slug: 'json', title: 'JSON Formatter', icon: '🧾', description: 'Pretty/minify/validate + accessor builder', route: '/utils/json' },
  { slug: 'codec', title: 'Base64 + URL Codec', icon: '🔣', description: 'Encode/decode Base64 and URL-encoding', route: '/utils/codec' },
  { slug: 'jwt', title: 'JWT Decoder', icon: '🔑', description: 'Decode header/payload, expiry check (no verify)', route: '/utils/jwt' },
  { slug: 'uuid', title: 'UUID Generator', icon: '🆔', description: 'Bulk v4 UUIDs in multiple formats', route: '/utils/uuid' },
  { slug: 'regex', title: 'Regex Tester', icon: '🔍', description: 'Live pattern matching with flags', route: '/utils/regex' },
  { slug: 'base', title: 'Base Converter', icon: '🔢', description: 'Live dec ↔ hex ↔ bin ↔ oct', route: '/utils/base' },
  { slug: 'yaml', title: 'JSON ↔ YAML', icon: '🔄', description: 'Convert both directions with validation', route: '/utils/yaml' },
  { slug: 'text', title: 'Text Toolkit', icon: '🔤', description: 'Case, counts, whitespace cleanup, Lorem', route: '/utils/text' },
];

export function utilBySlug(slug: string): UtilDef | undefined {
  return UTILS.find((u) => u.slug === slug);
}
