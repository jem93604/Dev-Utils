// Lightweight subsequence fuzzy scorer. Ranks consecutive and
// word-boundary matches higher. Signature is intentionally generic so
// fuse.js (or any engine) can replace it later without touching callers:
//   fuzzy(query, items, keyFn) => ranked items (best first)

export interface Scored<T> {
  item: T;
  score: number;
}

function scoreOne(q: string, text: string): number {
  const query = q.toLowerCase();
  const target = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let consec = 0;
  let lastIdx = -2;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      // boundary bonus: start of string or after space/symbol
      const boundary = ti === 0 || /[\s\-_./]/.test(target[ti - 1]);
      score += boundary ? 3 : 1;
      if (ti === lastIdx + 1) {
        consec += 1;
        score += consec * 2;
      } else {
        consec = 0;
      }
      lastIdx = ti;
      qi += 1;
    }
  }
  if (qi < query.length) return -1; // not all query chars matched
  // prefer shorter targets and prefix matches
  if (target.startsWith(query)) score += 5;
  score -= target.length * 0.01;
  return score;
}

export function fuzzy<T>(query: string, items: T[], keyFn: (item: T) => string): T[] {
  const q = query.trim();
  if (!q) return items;
  return items
    .map((item) => ({ item, score: scoreOne(q, keyFn(item)) }))
    .filter((s): s is Scored<T> => s.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.item);
}
