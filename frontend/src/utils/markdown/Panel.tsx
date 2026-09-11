import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';
import { buildHtmlExport, downloadTextFile, extractMermaidBlocks, normalizeMathDelimiters } from '../../lib/markdown';
import { CopyBtn, UtilShell as Shell } from '../ui';

const SAMPLE = [
  "# Markdown Renderer Preview",
  "",
  "This sample exercises almost every supported feature. Edit me!",
  "",
  "## Headings",
  "",
  "### Third-level heading",
  "",
  "#### Fourth-level heading",
  "",
  "## Text Formatting",
  "",
  "This is **bold text**, *italic text*, and ~~strikethrough text~~.",
  "",
  "You can also use `inline code`, press <kbd>Ctrl</kbd> + <kbd>K</kbd>, add <mark>highlighted text</mark>, and [a link](https://example.com).",
  "",
  "> This is a blockquote.",
  ">",
  "> It can span multiple lines.",
  "",
  "## Lists",
  "",
  "### Unordered list",
  "",
  "- Item one",
  "- Item two",
  "  - Nested item",
  "  - Another nested item",
  "- Item three",
  "",
  "### Ordered list",
  "",
  "1. First step",
  "2. Second step",
  "3. Third step",
  "   1. Nested ordered step",
  "   2. Another nested step",
  "",
  "### Task list",
  "",
  "- [x] Create a Markdown file",
  "- [x] Add sample content",
  "- [ ] Test the renderer",
  "",
  "## Code Block",
  "",
  "```python",
  "def greet(name: str) -> str:",
  "    return f\"Hello, {name}!\"",
  "",
  "print(greet(\"Markdown\"))",
  "```",
  "",
  "## Table",
  "",
  "| Feature | Supported | Notes |",
  "|---|---:|---|",
  "| Headings | Yes | Multiple levels |",
  "| Tables | Yes | With alignment |",
  "| Code blocks | Yes | Syntax highlighting |",
  "| Task lists | Yes | Checkbox support |",
  "",
  "## Mathematical Expressions",
  "",
  "Inline math: \\(E = mc^2\\) and also $a^2 + b^2 = c^2$.",
  "",
  "Block math:",
  "",
  "\\[",
  "\\int_0^1 x^2\\,dx = \\frac{1}{3}",
  "\\]",
  "",
  "$$",
  "L = \\frac{1}{2} \\rho v^2 S C_L",
  "$$",
  "",
  "## Horizontal Rule",
  "",
  "---",
  "",
  "## Image",
  "",
  "![Sample placeholder image](https://placehold.co/600x200/png?text=Markdown+Preview)",
  "",
  "## HTML",
  "",
  "<details>",
  "<summary>Click to expand</summary>",
  "",
  "This content is hidden until expanded. <mark>Highlighted</mark> and <kbd>Esc</kbd> work too.",
  "",
  "</details>",
  "",
  "## Footnote",
  "",
  "Here is a statement with a footnote.[^1]",
  "",
  "[^1]: This is the footnote text.",
  "",
  "## Diagram",
  "",
  "```mermaid",
  "graph TD",
  "  A[Editor] --> B[Preview]",
  "  B --> C[PDF / HTML]",
  "```",
  "",
  "## Final Note",
  "",
  "If all sections render correctly, the Markdown renderer supports a broad set of standard features.",
].join("\n");

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
  const normalized = useMemo(() => normalizeMathDelimiters(input), [input]);
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
        <button className="fmt-btn" onClick={() => setInput(SAMPLE)}>↺ Sample</button>
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
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeKatex]}
            components={{
              code(props) {
                const { className, children } = props as { className?: string; children?: React.ReactNode };
                if (String(className ?? '').includes('language-mermaid')) return <></>;
                return <code className={className}>{children}</code>;
              },
              pre(props) {
                const kids = Children.toArray(props.children);
                const isMermaid = kids.some(
                  (c) =>
                    isValidElement<{ className?: string }>(c) &&
                    String((c.props as { className?: string }).className ?? '').includes('language-mermaid'),
                );
                if (isMermaid) return <></>;
                return <pre>{props.children}</pre>;
              },
              a(props) {
                return <a {...props} target="_blank" rel="noopener noreferrer" />;
              },
              img(props) {
                return <img {...props} loading="lazy" alt={props.alt ?? ''} />;
              },
            }}
          >
            {normalized}
          </ReactMarkdown>
          {diagrams.map((d, i) => (
            <MermaidBlock key={i} code={d} />
          ))}
        </div>
      </div>
      <style>{`.md-split{display:grid;grid-template-columns:1fr 1fr;gap:12px}.md-editor{min-height:420px;font-family:'JetBrains Mono',monospace}.md-preview{border:1px solid var(--border);border-radius:10px;padding:16px 20px;overflow:auto;max-height:70vh;background:var(--surface);line-height:1.65;overflow-wrap:break-word}.md-preview>:first-child{margin-top:0}.md-preview>:last-child{margin-bottom:0}.md-preview h1,.md-preview h2{border-bottom:1px solid var(--border);padding-bottom:.3em}.md-preview blockquote{border-left:3px solid var(--border2,#ccc);margin:1em 0;padding:.2rem 0 .2rem 1rem;color:var(--text2);background:var(--amber-dim,transparent);border-radius:0 8px 8px 0}.md-preview blockquote>:first-child{margin-top:0}.md-preview blockquote>:last-child{margin-bottom:0}.md-preview hr{border:none;border-top:1px solid var(--border);margin:1.5em 0}.md-preview ul{list-style:disc;padding-left:1.5em;margin:1em 0}.md-preview ol{list-style:decimal;padding-left:1.5em;margin:1em 0}.md-preview li{margin:.25em 0}.md-preview li>ul,.md-preview li>ol{margin:.25em 0}.md-preview ul ul{list-style-type:circle}.md-preview ul ul ul{list-style-type:square}.md-preview ul.contains-task-list{list-style:none;padding-left:0}.md-preview ul.contains-task-list input[type=checkbox]{margin-right:.5em;accent-color:var(--green,#22c55e)}.md-preview table{border-collapse:collapse;width:100%;display:block;overflow:auto}.md-preview th,.md-preview td{border:1px solid var(--border);padding:6px 10px}.md-preview tr:nth-child(even){background:rgba(127,127,127,.08)}.md-preview pre{background:rgba(127,127,127,.12);padding:12px;border-radius:8px;overflow:auto}.md-preview code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.85em;background:rgba(127,127,127,.15);padding:.15em .35em;border-radius:4px}.md-preview pre code{background:none;padding:0}.md-preview .hljs{color:var(--code-fg);background:none}.md-preview .hljs-keyword,.md-preview .hljs-selector-tag{color:var(--kw)}.md-preview .hljs-string,.md-preview .hljs-regexp{color:var(--str)}.md-preview .hljs-number,.md-preview .hljs-literal{color:var(--num)}.md-preview .hljs-title,.md-preview .hljs-title-function_{color:var(--fn)}.md-preview .hljs-comment,.md-preview .hljs-quote{color:var(--cmt);font-style:italic}.md-preview .hljs-name{color:var(--green)}.md-preview .hljs-attr,.md-preview .hljs-attribute,.md-preview .hljs-variable{color:var(--var-c)}.md-preview .hljs-built_in{color:var(--purple)}.md-preview .hljs-addition{color:var(--green)}.md-preview .hljs-deletion{color:var(--red)}.md-preview .hljs-emphasis{font-style:italic}.md-preview .hljs-strong{font-weight:700}.md-preview img{max-width:100%;height:auto;border-radius:6px}.md-preview details{border:1px solid var(--border);border-radius:8px;padding:.6rem 1rem;margin:1em 0}.md-preview summary{cursor:pointer;font-weight:600}.md-preview kbd{background:rgba(127,127,127,.15);border:1px solid var(--border);border-bottom-width:2px;border-radius:4px;padding:.1em .4em;font-size:.85em}.md-preview mark{background:#fff8c5;color:#111;padding:.1em .2em;border-radius:3px}.md-preview .footnotes{font-size:.85em;color:var(--text2);border-top:1px solid var(--border);margin-top:2em}.md-preview .footnotes ol{padding-left:1.5em}.md-preview .footnote-backref,.md-preview .data-footnote-backref{text-decoration:none}.md-preview .katex-display{overflow:auto;padding:.5em 0}.md-preview .katex{font-size:1.05em}.md-mermaid{display:flex;justify-content:center;padding:8px 0}.md-mermaid svg{max-width:100%;height:auto}.md-mermaid-err{color:var(--red);white-space:pre-wrap}@media(max-width:900px){.md-split{grid-template-columns:1fr}}@media print{body *{visibility:hidden}.md-preview,.md-preview *{visibility:visible}.md-preview{position:absolute;inset:0;max-height:none;border:none}}`}</style>
    </Shell>
  );
}

export default MarkdownPanel;
