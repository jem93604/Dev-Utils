import { useMemo, useState } from 'react';
import { cleanWhitespace, lorem, textStats } from '../../lib/devtools';
import { CopyBtn, UtilShell as Shell } from '../ui';

export function TextPanel() {
  const [input, setInput] = useState('');
  const stats = useMemo(() => textStats(input), [input]);
  return (
    <Shell id="util-text" color="#b58900" title="🔤 Text Toolkit">
      <div className="fmt-btns" style={{ marginBottom: 10 }}>
        <button className="fmt-btn" onClick={() => setInput((s) => s.toUpperCase())}>UPPER</button>
        <button className="fmt-btn" onClick={() => setInput((s) => s.toLowerCase())}>lower</button>
        <button className="fmt-btn" onClick={() => setInput((s) => cleanWhitespace(s))}>Clean whitespace</button>
        <button className="fmt-btn" onClick={() => setInput((s) => (s ? s + '\n\n' : '') + lorem(1))}>+ Lorem</button>
        <button className="fmt-btn" onClick={() => setInput('')}>✕ Clear</button>
        <CopyBtn text={input} />
      </div>
      <textarea className="fmt-textarea" style={{ minHeight: 170 }} value={input}
        onChange={(e) => setInput(e.target.value)} placeholder="Paste or type text..." />
      <div style={{ marginTop: 8, fontFamily: "'JetBrains Mono',monospace", fontSize: '.72rem', color: 'var(--text3)' }}>
        {stats.chars} chars · {stats.words} words · {stats.lines} lines
      </div>
    </Shell>
  );
}

export default TextPanel;
