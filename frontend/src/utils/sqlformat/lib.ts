// SQL formatter: tokenizer-based, string/comment aware.
// Newlines before major clauses, indented AND/OR, optional keyword case.

export interface FormatOptions {
  uppercase?: boolean; // default true
  indent?: string; // default two spaces
}

const CLAUSE = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING',
  'LIMIT', 'OFFSET', 'UNION', 'UNION ALL', 'EXCEPT', 'INTERSECT',
  'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM',
]);
const JOIN_START = new Set([
  'JOIN', 'INNER JOIN', 'LEFT JOIN', 'LEFT OUTER JOIN', 'RIGHT JOIN',
  'RIGHT OUTER JOIN', 'FULL JOIN', 'FULL OUTER JOIN', 'CROSS JOIN',
]);
const COND = new Set(['AND', 'OR']);

interface Tok {
  text: string;
  quoted: boolean; // string literal or comment: never a keyword
}

function tokenize(sql: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = sql.length;
  let buf = '';
  const flush = () => {
    const t = buf.trim();
    if (t) toks.push({ text: t, quoted: false });
    buf = '';
  };
  while (i < n) {
    const c = sql[i] as string;
    // Line comment
    if (c === '-' && sql[i + 1] === '-') {
      flush();
      let j = i;
      while (j < n && sql[j] !== '\n') j++;
      toks.push({ text: sql.slice(i, j).replace(/\s+/g, ' ').trim(), quoted: true });
      i = j;
      continue;
    }
    // Block comment
    if (c === '/' && sql[i + 1] === '*') {
      flush();
      const end = sql.indexOf('*/', i + 2);
      const j = end === -1 ? n : end + 2;
      toks.push({ text: sql.slice(i, j).replace(/\s+/g, ' ').trim(), quoted: true });
      i = j;
      continue;
    }
    // Quoted literal (single, double, backtick); '' escapes inside single quotes
    if (c === "'" || c === '"' || c === '`') {
      flush();
      let j = i + 1;
      while (j < n) {
        if (sql[j] === c) {
          if (c === "'" && sql[j + 1] === "'") { j += 2; continue; }
          j++;
          break;
        }
        j++;
      }
      toks.push({ text: sql.slice(i, j), quoted: true });
      i = j;
      continue;
    }
    // Punctuation that stands alone
    if (c === '(' || c === ')' || c === ',' || c === ';') {
      flush();
      toks.push({ text: c, quoted: false });
      i++;
      continue;
    }
    if (/\s/.test(c)) {
      flush();
      i++;
      continue;
    }
    buf += c;
    i++;
  }
  flush();
  return toks;
}

/** Join adjacent words that form multi-word keywords (GROUP BY, INSERT INTO, ...). */
function mergeKeywords(toks: Tok[]): Tok[] {
  const out: Tok[] = [];
  const pairs: Record<string, string> = {
    'GROUP BY': 'GROUP BY', 'ORDER BY': 'ORDER BY', 'INSERT INTO': 'INSERT INTO',
    'DELETE FROM': 'DELETE FROM', 'UNION ALL': 'UNION ALL',
    'INNER JOIN': 'INNER JOIN', 'LEFT JOIN': 'LEFT JOIN', 'LEFT OUTER JOIN': 'LEFT OUTER JOIN',
    'RIGHT JOIN': 'RIGHT JOIN', 'RIGHT OUTER JOIN': 'RIGHT OUTER JOIN',
    'FULL JOIN': 'FULL JOIN', 'FULL OUTER JOIN': 'FULL OUTER JOIN', 'CROSS JOIN': 'CROSS JOIN',
  };
  let i = 0;
  while (i < toks.length) {
    const t = toks[i] as Tok;
    const nx = toks[i + 1];
    const nnx = toks[i + 2];
    if (!t.quoted && nx && !nx.quoted) {
      const three = nnx && !nnx.quoted ? `${t.text} ${nx.text} ${nnx.text}`.toUpperCase() : '';
      const two = `${t.text} ${nx.text}`.toUpperCase();
      if (three && pairs[three]) {
        out.push({ text: pairs[three] as string, quoted: false });
        i += 3;
        continue;
      }
      if (pairs[two]) {
        out.push({ text: pairs[two] as string, quoted: false });
        i += 2;
        continue;
      }
    }
    out.push(t);
    i++;
  }
  return out;
}

export function formatSql(input: string, opts: FormatOptions = {}): string {
  const upper = opts.uppercase ?? true;
  const indent = opts.indent ?? '  ';
  const toks = mergeKeywords(tokenize(input)).filter((t) => t.text !== ';');
  if (toks.length === 0) return '';

  const kw = (t: string) => (upper ? t.toUpperCase() : t.toLowerCase());
  const lines: string[] = [];
  let cur = '';

  const pushLine = () => {
    const t = cur.replace(/\s+$/, ''); // keep leading indent, drop trailing space
    if (t.trim()) lines.push(t);
    cur = '';
  };

  for (const tok of toks) {
    if (tok.quoted) {
      cur += cur && !cur.endsWith('(') ? ` ${tok.text}` : tok.text;
      continue;
    }
    const up = tok.text.toUpperCase();
    if (up === ',') {
      cur = cur.trimEnd() + ', ';
      continue;
    }
    if (up === '(') {
      cur = cur.trimEnd() + (cur.trim() ? ' (' : '(');
      continue;
    }
    if (up === ')') {
      cur = cur.trimEnd() + ')';
      continue;
    }
    if (CLAUSE.has(up) || JOIN_START.has(up)) {
      pushLine();
      cur = kw(up);
      continue;
    }
    if (COND.has(up)) {
      pushLine();
      cur = indent + kw(up);
      continue;
    }
    // Ordinary words stay inline; small keywords follow the case setting.
    const word = /^[A-Za-z]+$/.test(tok.text) && /^(DESC|ASC|ON|AS|NOT|NULL|IS|IN|LIKE|BETWEEN|DISTINCT)$/i.test(tok.text)
      ? kw(tok.text)
      : tok.text;
    cur += cur && !cur.endsWith(' ') && !cur.endsWith('(') ? ` ${word}` : word;
  }
  pushLine();
  // Collapse inner runs of spaces but preserve intentional line indent.
  return lines
    .map((l) => l.replace(/(\S) {2,}/g, '$1 ').trimEnd())
    .join('\n');
}
