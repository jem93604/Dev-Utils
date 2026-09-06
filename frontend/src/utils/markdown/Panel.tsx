import { useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import mermaid from 'mermaid';
import { buildHtmlExport, downloadTextFile, extractMermaidBlocks } from '../../lib/markdown';
import { CopyBtn, UtilShell as Shell } from '../ui';

const SAMPLE = `# Hello Markdown\n\nLive preview with **GFM**: tables, task lists, code.\n\n- [x] live preview\n- [ ] export\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n\`\`\`mermaid\ngraph TD\n  A[Editor] --> B[Preview]\n  B --> C[PDF / HTML]\n\`\`\`\n`;

mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

function MermaidBlock({ code }: { code: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    setErr('');
    mermaid
      .render(`mmd-${id}`, code)
      .then((r) => {
        if (alive && ref.current) ref.current.innerHTML = r.svg;
      })
      .catch((e) => {
        if (alive) setErr(String(e?.message ?? e));
      });
    return () => {
      alive = false;
    };
  }, [code, id]);
  if (err) return <pre className="md-mermaid-err">Mermaid error: {err}</pre>;
  return <div ref={ref} className="md-mermaid" />;
}

export function MarkdownPanel() {
  const [input, setInput] = useState(SAMPLE);
  const [title, setTitle] = useState('Markdown export');
  const previewRef = useRef<HTMLDivElement>(null);
  const diagrams = useMemo(() => extractMermaidBlocks(input), [input]);

  const printPdf = () => window.print();

  const downloadMd = () => downloadTextFile('markdown-export.md', input, 'text/markdown');

  const downloadHtml = () => {
    const body = previewRef.current?.innerHTML ?? '';
    downloadTextFile('markdown-export.html', buildHtmlExport(body, title), 'text/html');
  };

  return (
    <Shell id="util-markdown" color="#22c55e" title="📝 Markdown Preview">
      <div className="fmt-btns" style={{ marginBottom: 10 }}>
        <input
          className="fmt-input"
          style={{ maxWidth: 220 }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Export title"
          aria-label="Export title"
        />
        <button className="fmt-btn fmt-btn-primary" onClick={printPdf}>⬇ Print / PDF</button>
        <button className="fmt-btn" onClick={downloadMd}>⬇ .md</button>
        <button className="fmt-btn" onClick={downloadHtml}>⬇ .html</button>
        <button className="fmt-btn" onClick={() => setInput('')}>✕ Clear</button>
        <CopyBtn text={input} />
      </div>
      <div className="md-split">
        <textarea
          className="fmt-textarea md-editor"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type Markdown…"
          aria-label="Markdown source"
        />
        <div ref={previewRef} className="md-preview" aria-label="Live preview">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              code(props) {
                const { className, children } = props as { className?: string; children?: React.ReactNode };
                if (String(className ?? '').includes('language-mermaid')) return <></>;
                return <code className={className}>{children}</code>;
              },
              pre(props) {
                return <pre>{props.children}</pre>;
              },
            }}
          >
            {input}
          </ReactMarkdown>
          {diagrams.map((d, i) => (
            <MermaidBlock key={i} code={d} />
          ))}
        </div>
      </div>
      <style>{`.md-split{display:grid;grid-template-columns:1fr 1fr;gap:12px}.md-editor{min-height:420px;font-family:'JetBrains Mono',monospace}.md-preview{border:1px solid var(--border);border-radius:10px;padding:16px;overflow:auto;max-height:70vh;background:var(--surface)}.md-preview table{border-collapse:collapse;width:100%}.md-preview th,.md-preview td{border:1px solid var(--border);padding:6px 10px}.md-preview pre{background:rgba(127,127,127,.12);padding:12px;border-radius:8px;overflow:auto}.md-mermaid{display:flex;justify-content:center;padding:8px 0}.md-mermaid svg{max-width:100%;height:auto}@media(max-width:900px){.md-split{grid-template-columns:1fr}}@media print{body *{visibility:hidden}.md-preview,.md-preview *{visibility:visible}.md-preview{position:absolute;inset:0;max-height:none;border:none}}`}</style>
    </Shell>
  );
}

export default MarkdownPanel;
