import { useState } from 'react';
import { formatData, type FmtKind } from '../../lib/format';
import { SectionHeader, toast } from '../../components/ui';

export function FormatterPanel() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const run = (t: FmtKind) => {
    const r = formatData(input, t);
    setOutput(r.output);
    if (r.note) toast(r.note);
  };
  return (
    <section id="sec-formatter" className="section-block">
      <SectionHeader color="#94a3b8" title="🛠 Data Formatter" />
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: 16 }}>
        <div className="fmt-grid">
          <div className="fmt-col">
            <label>Input — paste values here</label>
            <textarea className="fmt-textarea" value={input} onChange={(e) => setInput(e.target.value)} placeholder={'25-I-VMF-28819\n25-I-POT-96393'} />
            <div className="fmt-btns">
              {(['sql', 'csv', 'upper', 'lower', 'lines', 'dedup', 'count', 'trim'] as FmtKind[]).map((k) => (
                <button key={k} className="fmt-btn" onClick={() => run(k)}>{k}</button>
              ))}
            </div>
          </div>
          <div className="fmt-col">
            <label>Output — copy from here</label>
            <textarea className="fmt-textarea" readOnly value={output} placeholder="Formatted output appears here..." />
            <div className="fmt-btns">
              <button className="fmt-btn" onClick={() => { navigator.clipboard.writeText(output); toast('Output copied ✓'); }}>⎘ Copy Output</button>
              <button className="fmt-btn" onClick={() => { setInput(output); setOutput(input); }}>⇄ Swap</button>
              <button className="fmt-btn" onClick={() => { setInput(''); setOutput(''); }}>✕ Clear</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FormatterPanel;
