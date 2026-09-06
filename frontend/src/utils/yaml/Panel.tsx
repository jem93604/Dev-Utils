import { useMemo, useState } from 'react';
import * as YAML from 'yaml';
import { CopyBtn, ErrMsg as Err, OutBox as Out, UtilShell as Shell } from '../ui';

export function YamlPanel() {
  const [input, setInput] = useState('');
  const [toYaml, setToYaml] = useState(true);
  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: '' };
    try {
      const output = toYaml
        ? YAML.stringify(JSON.parse(input))
        : JSON.stringify(YAML.parse(input), null, 2);
      return { output, error: '' };
    } catch (e) {
      return { output: '', error: e instanceof Error ? e.message : 'Conversion failed' };
    }
  }, [input, toYaml]);

  return (
    <Shell id="util-yaml" color="#2aa198" title="🔄 JSON ↔ YAML">
      <div className="fmt-btns" style={{ marginBottom: 10 }}>
        <button className="fmt-btn" onClick={() => setToYaml(true)}
          style={toYaml ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}>JSON → YAML</button>
        <button className="fmt-btn" onClick={() => setToYaml(false)}
          style={!toYaml ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}>YAML → JSON</button>
      </div>
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>Input ({toYaml ? 'JSON' : 'YAML'})</label>
          <textarea className="fmt-textarea" style={{ minHeight: 170 }} value={input} onChange={(e) => setInput(e.target.value)} />
          <Err msg={error} />
        </div>
        <div className="fmt-col">
          <label>Output ({toYaml ? 'YAML' : 'JSON'})</label>
          <Out value={output} minHeight={170} />
          <div className="fmt-btns"><CopyBtn text={output} /></div>
        </div>
      </div>
    </Shell>
  );
}

export default YamlPanel;
