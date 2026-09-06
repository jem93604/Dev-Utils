import { useMemo, useState } from 'react';
import { CopyBtn, ErrMsg as Err, OutBox as Out, UtilShell as Shell } from '../ui';

export function RegexPanel() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [corpus, setCorpus] = useState('');
  const { matches, error } = useMemo(() => {
    if (!pattern) return { matches: [] as string[], error: '' };
    try {
      const re = new RegExp(pattern, flags);
      return { matches: [...corpus.matchAll(re)].slice(0, 50).map((m) => m[0]), error: '' };
    } catch (e) {
      return { matches: [] as string[], error: e instanceof Error ? e.message : 'Invalid regex' };
    }
  }, [pattern, flags, corpus]);

  return (
    <Shell id="util-regex" color="#fd971f" title="🔍 Regex Tester">
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input className="input-field" value={pattern} onChange={(e) => setPattern(e.target.value)}
          placeholder="Pattern, e.g. \d{2}-[A-Z]+-\d+" style={{ flex: 3, fontFamily: "'JetBrains Mono',monospace" }} />
        <input className="input-field" value={flags} onChange={(e) => setFlags(e.target.value)}
          placeholder="flags" style={{ flex: 1, maxWidth: 90, fontFamily: "'JetBrains Mono',monospace" }} />
      </div>
      <Err msg={error} />
      <div className="fmt-grid" style={{ marginTop: 8 }}>
        <div className="fmt-col">
          <label>Test text</label>
          <textarea className="fmt-textarea" style={{ minHeight: 140 }} value={corpus} onChange={(e) => setCorpus(e.target.value)} />
        </div>
        <div className="fmt-col">
          <label>Matches ({matches.length})</label>
          <Out value={matches.join('\n')} minHeight={140} />
          <div className="fmt-btns"><CopyBtn text={matches.join('\n')} /></div>
        </div>
      </div>
    </Shell>
  );
}

export default RegexPanel;
