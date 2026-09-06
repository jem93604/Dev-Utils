import { useMemo, useState } from 'react';
import { b64decode, b64encode } from '../../lib/devtools';
import { CopyBtn, ErrMsg as Err, OutBox as Out, UtilShell as Shell } from '../ui';

type CodecMode = 'b64e' | 'b64d' | 'urle' | 'urld';

export function CodecPanel() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<CodecMode>('b64e');
  const { output, error } = useMemo(() => {
    if (!input) return { output: '', error: '' };
    try {
      const output =
        mode === 'b64e' ? b64encode(input) :
        mode === 'b64d' ? b64decode(input) :
        mode === 'urle' ? encodeURIComponent(input) :
        decodeURIComponent(input);
      return { output, error: '' };
    } catch {
      return { output: '', error: 'Decode failed — invalid input' };
    }
  }, [input, mode]);

  return (
    <Shell id="util-codec" color="#a6e22e" title="🔣 Base64 + URL Codec">
      <div className="fmt-btns" style={{ marginBottom: 10 }}>
        {([['b64e', 'B64 Encode'], ['b64d', 'B64 Decode'], ['urle', 'URL Encode'], ['urld', 'URL Decode']] as [CodecMode, string][]).map(([m, label]) => (
          <button key={m} className="fmt-btn" onClick={() => setMode(m)}
            style={mode === m ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}>{label}</button>
        ))}
      </div>
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>Input</label>
          <textarea className="fmt-textarea" style={{ minHeight: 150 }} value={input} onChange={(e) => setInput(e.target.value)} />
          <Err msg={error} />
        </div>
        <div className="fmt-col">
          <label>Output</label>
          <Out value={output} minHeight={150} />
          <div className="fmt-btns"><CopyBtn text={output} /></div>
        </div>
      </div>
    </Shell>
  );
}

export default CodecPanel;
