// Developer utility panels. Reuse .fmt-* / .section-* theme classes.
// Each panel is standalone and mounted on its own /utils/* route.
import { useMemo, useState } from 'react';
import * as YAML from 'yaml';
import {
  b64decode, b64encode, cleanWhitespace, convertBase, decodeJwt, genUuids,
  lorem, parseTimeInput, pgTimeSnippets, textStats, type UuidFormat,
} from '../lib/devtools';
import { Field, SectionHeader, toast } from './ui';

function Shell({ id, color, title, children }: { id: string; color: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="section-block">
      <SectionHeader color={color} title={title} />
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: 16 }}>
        {children}
      </div>
    </section>
  );
}

function CopyBtn({ text }: { text: string }) {
  return (
    <button
      className="fmt-btn"
      onClick={() => { if (text) { navigator.clipboard.writeText(text); toast('Copied ✓'); } }}
    >
      ⎘ Copy
    </button>
  );
}

function Out({ value, minHeight }: { value: string; minHeight?: number }) {
  return (
    <textarea className="fmt-textarea" readOnly value={value}
      style={minHeight ? { minHeight } : undefined} placeholder="Output appears here..." />
  );
}

function Err({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <div style={{ color: 'var(--red)', fontSize: '.76rem', marginTop: 6 }}>{msg}</div>;
}

/* ---------- 🕒 Time Converter ---------- */

export function TimePanel() {
  const [input, setInput] = useState('');
  const r = useMemo(() => parseTimeInput(input), [input]);
  const rows: [string, string][] = r.ok
    ? [
      ['ISO', r.iso!], ['IST', r.ist!], ['UTC', r.utc!],
      ['Local', r.local!], ['Epoch (s)', String(r.epochS!)],
      ['Epoch (ms)', String(r.epochMs!)], ['Relative', r.relative!],
    ]
    : [];
  return (
    <Shell id="util-time" color="#e6db74" title="🕒 Time Converter">
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>Epoch or date string</label>
          <textarea className="fmt-textarea" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="1718445600  •  1718445600000  •  2024-06-15 10:30" />
          <div className="fmt-btns">
            <button className="fmt-btn" onClick={() => setInput(String(Math.floor(Date.now() / 1000)))}>Now (epoch)</button>
            <button className="fmt-btn" onClick={() => { setInput(''); }}>✕ Clear</button>
          </div>
          <Err msg={input.trim() ? r.error : undefined} />
        </div>
        <div className="fmt-col">
          <label>Converted</label>
          <Out value={rows.map(([k, v]) => `${k}: ${v}`).join('\n')} minHeight={140} />
          <div className="fmt-btns"><CopyBtn text={rows.map(([, v]) => v).join('\n')} /></div>
        </div>
      </div>
      {r.ok && (
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: '.66rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 5 }}>
            Postgres snippet
          </label>
          <Out value={pgTimeSnippets(r.epochS!)} />
          <div className="fmt-btns"><CopyBtn text={pgTimeSnippets(r.epochS!)} /></div>
        </div>
      )}
    </Shell>
  );
}

/* ---------- 🧾 JSON Formatter ---------- */

function buildAccessors(obj: unknown, path: string[]): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return [];
  const out: string[] = [];
  for (const k of Object.keys(obj as Record<string, unknown>)) {
    const trail = [...path, k];
    const nav = `data${trail.map((p) => ` -> '${p}'`).join('')}`;
    const navText = `data${trail.map((p) => ` ->> '${p}'`).join('')}`;
    out.push(nav, navText);
    const v = (obj as Record<string, unknown>)[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...buildAccessors(v, trail));
    }
  }
  return out;
}

export function JsonPanel() {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');
  const [accessors, setAccessors] = useState<string[]>([]);

  const run = (mode: 'pretty' | 'min') => {
    try {
      const obj = JSON.parse(input);
      setOutput(mode === 'pretty' ? JSON.stringify(obj, null, 2) : JSON.stringify(obj));
      setAccessors(buildAccessors(obj, []).slice(0, 30));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  return (
    <Shell id="util-json" color="#66d9ef" title="🧾 JSON Formatter">
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>JSON input</label>
          <textarea className="fmt-textarea" style={{ minHeight: 180 }} value={input}
            onChange={(e) => setInput(e.target.value)} placeholder='{"a": 1}' />
          <div className="fmt-btns">
            <button className="fmt-btn" onClick={() => run('pretty')}>Pretty</button>
            <button className="fmt-btn" onClick={() => run('min')}>Minify</button>
            <button className="fmt-btn" onClick={() => { setInput(''); setOutput(''); setAccessors([]); setError(''); }}>✕ Clear</button>
          </div>
          <Err msg={error} />
        </div>
        <div className="fmt-col">
          <label>Output</label>
          <Out value={output} minHeight={180} />
          <div className="fmt-btns"><CopyBtn text={output} /></div>
        </div>
      </div>
      {accessors.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: '.66rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 5 }}>
            Postgres accessors
          </label>
          <Out value={accessors.join('\n')} />
          <div className="fmt-btns"><CopyBtn text={accessors.join('\n')} /></div>
        </div>
      )}
    </Shell>
  );
}

/* ---------- 🔣 Base64 + URL Codec ---------- */

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

/* ---------- 🔑 JWT Decoder ---------- */

export function JwtPanel() {
  const [input, setInput] = useState('');
  const r = useMemo(() => (input.trim() ? decodeJwt(input) : null), [input]);
  return (
    <Shell id="util-jwt" color="#ae81ff" title="🔑 JWT Decoder">
      <Field label="Token (decode only — signature is NOT verified)">
        <textarea className="fmt-textarea" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="eyJhbGciOi..." rows={3} />
      </Field>
      <Err msg={r?.error} />
      {r?.ok && (
        <div className="fmt-grid" style={{ marginTop: 8 }}>
          <div className="fmt-col">
            <label>Header</label>
            <Out value={JSON.stringify(r.header, null, 2)} minHeight={120} />
          </div>
          <div className="fmt-col">
            <label>
              Payload {r.expiresAt && (
                <span style={{ color: r.expired ? 'var(--red)' : 'var(--green)', marginLeft: 6 }}>
                  {r.expired ? `expired ${r.expiresAt}` : `valid until ${r.expiresAt}`}
                </span>
              )}
            </label>
            <Out value={JSON.stringify(r.payload, null, 2)} minHeight={120} />
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ---------- 🆔 UUID Generator ---------- */

export function UuidPanel() {
  const [count, setCount] = useState(5);
  const [format, setFormat] = useState<UuidFormat>('dashes');
  const [list, setList] = useState<string[]>([]);
  return (
    <Shell id="util-uuid" color="#f92672" title="🆔 UUID Generator">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <label style={{ fontSize: '.72rem', color: 'var(--text2)' }}>Count</label>
        <input className="input-field" type="number" min={1} max={200} value={count}
          onChange={(e) => setCount(Number(e.target.value))} style={{ width: 90 }} />
        {(['dashes', 'plain', 'upper'] as UuidFormat[]).map((f) => (
          <button key={f} className="fmt-btn" onClick={() => setFormat(f)}
            style={format === f ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}>{f}</button>
        ))}
        <button className="fmt-btn" onClick={() => setList(genUuids(count, format))}>Generate</button>
        <CopyBtn text={list.join('\n')} />
      </div>
      <Out value={list.join('\n')} minHeight={150} />
      <div style={{ marginTop: 10 }}>
        <label style={{ fontSize: '.66rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', display: 'block', marginBottom: 5 }}>
          Postgres
        </label>
        <Out value="SELECT gen_random_uuid();" />
      </div>
    </Shell>
  );
}

/* ---------- 🔍 Regex Tester ---------- */

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

/* ---------- 🔢 Base Converter ---------- */

type Base = 'dec' | 'hex' | 'bin' | 'oct';

export function BasePanel() {
  const [from, setFrom] = useState<Base>('dec');
  const [value, setValue] = useState('');
  const r = useMemo(() => convertBase(value, from), [value, from]);
  const fields: [Base, string][] = [['dec', r.dec], ['hex', r.hex], ['bin', r.bin], ['oct', r.oct]];
  return (
    <Shell id="util-base" color="#57a8c4" title="🔢 Number Base Converter">
      <div className="fmt-btns" style={{ marginBottom: 10 }}>
        {(['dec', 'hex', 'bin', 'oct'] as Base[]).map((b) => (
          <button key={b} className="fmt-btn" onClick={() => setFrom(b)}
            style={from === b ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}>
            from {b}
          </button>
        ))}
      </div>
      <Field label={`Input (base ${from})`}>
        <input className="input-field" value={value} onChange={(e) => setValue(e.target.value)}
          placeholder={from === 'hex' ? '0xFF' : from === 'bin' ? '0b1010' : from === 'oct' ? '0o17' : '255'}
          style={{ fontFamily: "'JetBrains Mono',monospace" }} />
      </Field>
      <Err msg={r.error} />
      <div className="fmt-grid" style={{ marginTop: 8 }}>
        {fields.map(([b, v]) => (
          <div className="fmt-col" key={b} style={{ marginBottom: 8 }}>
            <label>{b}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="input-field" readOnly value={v} style={{ fontFamily: "'JetBrains Mono',monospace" }} />
              <CopyBtn text={v} />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* ---------- 🔄 JSON ↔ YAML ---------- */

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

/* ---------- 🔤 Text Toolkit ---------- */

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
