import { useState } from 'react';
import { buildUrl, decodeComponent, encodeComponent, encodeUrlFull, splitUrl, type QueryParam } from './lib';
import { CopyBtn, ErrMsg, OutBox, UtilShell } from '../ui';

type Mode = 'component' | 'full' | 'params';

export function UrlCodecPanel() {
  const [mode, setMode] = useState<Mode>('component');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [params, setParams] = useState<QueryParam[]>([{ key: '', value: '' }]);
  const [base, setBase] = useState('');
  const [error, setError] = useState<string | undefined>();

  const runEncode = () => {
    setError(undefined);
    try {
      setOutput(mode === 'full' ? encodeUrlFull(input) : encodeComponent(input));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Encode failed');
    }
  };

  const runDecode = () => {
    setError(undefined);
    try {
      setOutput(decodeComponent(input));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decode failed');
    }
  };

  const runSplit = () => {
    setError(undefined);
    try {
      const r = splitUrl(input);
      setBase(r.base);
      setParams(r.params.length > 0 ? r.params : [{ key: '', value: '' }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Split failed');
    }
  };

  const setParam = (i: number, field: 'key' | 'value', v: string) => {
    setParams((prev) => prev.map((p, j) => (j === i ? { ...p, [field]: v } : p)));
  };

  const rebuilt = (() => {
    try {
      return buildUrl(base, params.filter((p) => p.key !== ''));
    } catch {
      return '';
    }
  })();

  return (
    <UtilShell id="util-urlcodec" color="#22c55e" title="🔗 URL Codec">
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>Input</label>
          <textarea className="fmt-textarea" rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://example.com/search?q=hello world" spellCheck={false} />
          <div className="fmt-btns">
            <select className="fmt-btn" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
              <option value="component">URIComponent</option>
              <option value="full">Full URL (encodeURI)</option>
              <option value="params">Split query params</option>
            </select>
            {mode === 'params'
              ? <button className="fmt-btn" onClick={runSplit}>Split</button>
              : <><button className="fmt-btn" onClick={runEncode}>Encode</button><button className="fmt-btn" onClick={runDecode}>Decode</button></>}
            <button className="fmt-btn" onClick={() => { setInput(''); setOutput(''); }}>✕ Clear</button>
          </div>
          <ErrMsg msg={error} />
        </div>
        <div className="fmt-col">
          {mode === 'params' ? (
            <>
              <label>Base</label>
              <textarea className="fmt-textarea" rows={2} value={base} onChange={(e) => setBase(e.target.value)} spellCheck={false} />
              <label>Params</label>
              {params.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input className="input-field" value={p.key} onChange={(e) => setParam(i, 'key', e.target.value)} placeholder="key" style={{ flex: 1 }} />
                  <input className="input-field" value={p.value} onChange={(e) => setParam(i, 'value', e.target.value)} placeholder="value" style={{ flex: 2 }} />
                  <button className="fmt-btn" onClick={() => setParams((prev) => prev.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <div className="fmt-btns">
                <button className="fmt-btn" onClick={() => setParams((prev) => [...prev, { key: '', value: '' }])}>+ Param</button>
              </div>
              <label>Rebuilt URL</label>
              <OutBox value={rebuilt} />
              <div className="fmt-btns"><CopyBtn text={rebuilt} /></div>
            </>
          ) : (
            <>
              <label>Output</label>
              <OutBox value={output} minHeight={120} />
              <div className="fmt-btns"><CopyBtn text={output} /></div>
            </>
          )}
        </div>
      </div>
    </UtilShell>
  );
}

export default UrlCodecPanel;
