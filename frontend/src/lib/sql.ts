// SQL helpers ported from SQL_HUB_v1.html (renderCardSQL / detectTags / copy substitution).
// Output HTML reuses theme classes: .kw .str .cmt .var-highlight

const KWS = ['SELECT','FROM','WHERE','JOIN','LEFT JOIN','RIGHT JOIN','INNER JOIN','AND','OR','IN','NOT IN','ON','AS','SET','UPDATE','DELETE','INSERT INTO','VALUES','GROUP BY','ORDER BY','HAVING','LIMIT','BEGIN','COMMIT','ROLLBACK','CREATE','DROP','ALTER','TABLE','INDEX','DISTINCT','COUNT','SUM','AVG','MAX','MIN','UNION','ALL','IS NULL','IS NOT NULL','NULL','NOT','CASE','WHEN','THEN','ELSE','END','WITH','RETURNING','COALESCE','LIKE'];

export function extractVariables(sql: string): string[] {
  const out: string[] = [];
  for (const m of sql.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

export function substitute(sql: string, vals: Record<string, string>): string {
  let out = sql;
  for (const [k, v] of Object.entries(vals)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

export function detectTags(sql: string): string[] {
  const u = sql.toUpperCase();
  const tags: string[] = [];
  if (u.includes('SELECT')) tags.push('SELECT');
  if (u.includes('UPDATE')) tags.push('UPDATE');
  if (u.includes('DELETE')) tags.push('DELETE');
  if (u.includes('BEGIN')) tags.push('BEGIN');
  return tags;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Highlight SQL + injected values. Returns HTML string for <code> blocks. */
export function renderSql(sql: string, vals: Record<string, string>): string {
  let out = sql;
  // sentinel pass (same technique as original to avoid span-eating)
  for (const [k, v] of Object.entries(vals)) {
    if (v) out = out.split(`{{${k}}}`).join(`\x00VAR_S\x00${v}\x00VAR_E\x00`);
  }
  out = out.replace(/\{\{([^}]+)\}\}/g, (_, k) => `\x00PH_S\x00${k}\x00PH_E\x00`);
  out = esc(out);
  for (const kw of KWS) {
    out = out.replace(new RegExp(`(?<![a-z_])${kw}(?![a-z_])`, 'g'), `<span class="kw">${kw}</span>`);
  }
  out = out.replace(/'([^']*)'/g, `<span class="str">'$1'</span>`);
  out = out.replace(/(--[^\n]*)/g, `<span class="cmt">$1</span>`);
  out = out.replace(/(#[^\n]*)/g, `<span class="cmt">$1</span>`);
  out = out.replace(/\x00VAR_S\x00(.*?)\x00VAR_E\x00/g, (_, v) => `<span class="var-highlight">${v}</span>`);
  out = out.replace(/\x00PH_S\x00(.*?)\x00PH_E\x00/g, (_, k) => `<span style="color:var(--purple)">{{${k}}}</span>`);
  return out;
}
