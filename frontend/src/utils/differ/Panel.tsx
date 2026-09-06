import { useState } from 'react';
import { diffLines } from '../../lib/format';
import { SectionHeader } from '../../components/ui';

export function DifferPanel() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [ran, setRan] = useState(false);
  const lines = ran ? diffLines(a, b) : [];
  return (
    <section id="sec-diff" className="section-block">
      <SectionHeader color="#60a5fa" title="🔄 SQL Differ" />
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: 16 }}>
        <div className="fmt-grid" style={{ marginBottom: 12 }}>
          <div className="fmt-col"><label>Query A (Original)</label>
            <textarea className="fmt-textarea" style={{ minHeight: 140 }} value={a} onChange={(e) => setA(e.target.value)} /></div>
          <div className="fmt-col"><label>Query B (Modified)</label>
            <textarea className="fmt-textarea" style={{ minHeight: 140 }} value={b} onChange={(e) => setB(e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="fmt-btn" onClick={() => setRan(true)}>🔍 Compare</button>
          <button className="fmt-btn" onClick={() => { setA(''); setB(''); setRan(false); }}>✕ Clear</button>
        </div>
        {ran && (
          <div style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 7, padding: 12, fontFamily: "'JetBrains Mono',monospace", fontSize: '.73rem', lineHeight: 1.8 }}>
            {lines.map((l, i) => (
              <div key={i} className={l.kind === 'added' ? 'diff-added' : l.kind === 'removed' ? 'diff-removed' : undefined} style={{ padding: '1px 4px' }}>
                {l.kind === 'added' ? `+ ${l.text}` : l.kind === 'removed' ? `− ${l.text}` : `  ${l.text}`}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default DifferPanel;
