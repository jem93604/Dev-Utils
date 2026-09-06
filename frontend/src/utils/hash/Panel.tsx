import { useState } from 'react';
import { hashDjb2, hashFnv1a, sha256Hex } from './lib';
import { CopyBtn, ErrMsg, OutBox, UtilShell } from '../ui';

type Algo = 'djb2' | 'fnv1a' | 'sha256';

export function HashPanel() {
  const [input, setInput] = useState('');
  const [algo, setAlgo] = useState<Algo>('sha256');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | undefined>();

  const run = async () => {
    setError(undefined);
    try {
      if (algo === 'djb2') setOutput(hashDjb2(input));
      else if (algo === 'fnv1a') setOutput(hashFnv1a(input));
      else setOutput(await sha256Hex(input));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hash failed');
    }
  };

  return (
    <UtilShell id="util-hash" color="#f59e0b" title="🔒 Hash Generator">
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>Input</label>
          <textarea className="fmt-textarea" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Text to hash..." />
          <div className="fmt-btns">
            <select className="fmt-btn" value={algo} onChange={(e) => setAlgo(e.target.value as Algo)}>
              <option value="djb2">djb2</option>
              <option value="fnv1a">fnv-1a</option>
              <option value="sha256">sha256</option>
            </select>
            <button className="fmt-btn" onClick={run}>Hash</button>
            <button className="fmt-btn" onClick={() => { setInput(''); setOutput(''); }}>✕ Clear</button>
          </div>
          <ErrMsg msg={error} />
        </div>
        <div className="fmt-col">
          <label>Digest ({algo})</label>
          <OutBox value={output} />
          <div className="fmt-btns"><CopyBtn text={output} /></div>
        </div>
      </div>
    </UtilShell>
  );
}

export default HashPanel;
