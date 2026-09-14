import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';
import {
  buildHtmlExport,
  downloadTextFile,
  extractMermaidBlocks,
  getExportCss,
  normalizeMathDelimiters,
} from '../../lib/markdown';
import { CopyBtn, UtilShell as Shell } from '../ui';
import { toast } from '../../components/ui';

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
  const [pdfTheme, setPdfTheme] = useState<'light' | 'dark'>('dark');
  const [pdfBusy, setPdfBusy] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const normalized = useMemo(() => normalizeMathDelimiters(input), [input]);
  const diagrams = useMemo(() => extractMermaidBlocks(input), [input]);

  const printPdf = () => {
    // Name the PDF after the export title (browsers default the filename +
    // header line to document.title, which is otherwise "SQL Hub …").
    // body.md-pdf-dark switches the print stylesheet to the dark theme.
    const prev = document.title;
    const t = title.trim();
    if (t) document.title = t;
    document.body.classList.toggle('md-pdf-dark', pdfTheme === 'dark');
    const cleanup = () => {
      document.title = prev;
      document.body.classList.remove('md-pdf-dark');
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    try {
      window.print();
    } finally {
      // Fallback — some browsers fire afterprint unreliably.
      setTimeout(cleanup, 1000);
    }
  };

  /**
   * Direct in-JS PDF: render the themed export in an off-screen host,
   * rasterize it with html-to-image, then paginate into jsPDF. No print
   * dialog → no Chrome date/URL headers, and backgrounds are baked in.
   */
  const downloadPdf = async () => {
    const body = previewRef.current?.innerHTML ?? '';
    if (!body.trim()) {
      toast('Nothing to export yet');
      return;
    }
    setPdfBusy(true);
    const host = document.createElement('div');
    try {
      const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
      const dark = pdfTheme === 'dark';
      host.style.cssText = `position:fixed;left:-10000px;top:0;width:794px;background:${dark ? '#0b1220' : '#ffffff'};`;
      host.innerHTML =
        `<style>${getExportCss(pdfTheme)}</style>` +
        `<div class="export-doc${dark ? ' export-dark' : ''}">` +
        `${body}</div>`;
      document.body.appendChild(host);
      // Don't block on document.fonts (skipFonts is set) — just let any
      // in-host <img> settle so remote images aren't blank. Fast path with
      // a short timeout so a slow image can't stall the export.
      try {
        const pending = [...host.querySelectorAll('img')].filter((el) => !el.complete);
        if (pending.length > 0) {
          await Promise.race([
            Promise.allSettled(
              pending.map((el) =>
                // decode() rejects for broken images — placeholder covers those
                el.decode().catch(() => undefined),
              ),
            ),
            new Promise((r) => setTimeout(r, 1500)),
          ]);
        }
        // One frame so layout/SVG settles before rasterizing.
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      } catch {
        /* images are best-effort */
      }
      // NOTE: firstElementChild here is the injected <style> tag — the
      // renderable export is the .export-doc div after it.
      const target = host.querySelector<HTMLElement>('.export-doc');
      if (!target) throw new Error('render host is empty');
      // Adaptive resolution: a fixed pixelRatio 2 on a long doc produces a
      // giant canvas (slow encode, huge PDF, can hit canvas limits). Scale
      // down for tall docs — still sharp on paper, much faster.
      const cssW = target.offsetWidth || 794;
      const cssH = target.scrollHeight || target.offsetHeight || 1000;
      const pixelRatio = cssH > 6000 ? 1 : cssH > 3500 ? 1.3 : cssH > 1800 ? 1.6 : 2;
      // JPEG encodes ~3-5x faster than PNG with far smaller PDFs. Background
      // is always solid so no transparency is lost. cacheBust is dropped —
      // it refetches every remote image and only slows things down.
      const dataUrl = await toJpeg(target, {
        pixelRatio,
        quality: 0.92,
        backgroundColor: dark ? '#0b1220' : '#ffffff',
        // Skip webfont re-embedding: the Google Fonts stylesheet is
        // cross-origin without CORS, so html-to-image can only log
        // SecurityErrors while reading it. The export CSS uses system
        // font stacks anyway, so nothing visual is lost.
        skipFonts: true,
        imagePlaceholder:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      });
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      // No Image round-trip: aspect comes straight from layout metrics.
      const fullH = (cssH / cssW) * pageW;
      let y = 0;
      let pages = 0;
      while (y < fullH - 0.5) {
        if (pages > 0) pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, -y, pageW, fullH);
        y += pageH;
        pages += 1;
      }
      pdf.save(`${slug}${dark ? '-dark' : ''}.pdf`);
      toast('PDF saved ✓');
    } catch (e) {
      toast(e instanceof Error ? `PDF failed (${e.message})` : 'PDF failed');
    } finally {
      host.remove();
      setPdfBusy(false);
    }
  };

  const slug =
    title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') ||
    'markdown-export';

  const downloadMd = () => downloadTextFile(`${slug}.md`, input, 'text/markdown');

  const downloadHtml = () => {
    const body = previewRef.current?.innerHTML ?? '';
    const suffix = pdfTheme === 'dark' ? '-dark' : '';
    downloadTextFile(`${slug}${suffix}.html`, buildHtmlExport(body, title.trim() || 'Markdown export', pdfTheme), 'text/html');
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
        <button
          className="fmt-btn fmt-btn-primary"
          onClick={() => void downloadPdf()}
          disabled={pdfBusy}
          title="Direct PDF export — no browser headers, keeps the selected theme"
        >
          {pdfBusy ? '… Rendering PDF' : '⬇ PDF'}
        </button>
        <button className="fmt-btn" onClick={printPdf} disabled={pdfBusy} title="Browser print dialog">
          🖨 Print
        </button>
        <span className="fmt-btns" style={{ marginTop: 0 }} role="group" aria-label="PDF theme">
          {(['light', 'dark'] as const).map((t) => (
            <button
              key={t}
              className="fmt-btn"
              aria-pressed={pdfTheme === t}
              onClick={() => setPdfTheme(t)}
              style={pdfTheme === t ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}
              title={t === 'dark' ? 'Dark PDF theme' : 'Light PDF theme'}
            >
              {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </button>
          ))}
        </span>
        <button className="fmt-btn" onClick={downloadMd}>⬇ .md</button>
        <button className="fmt-btn" onClick={downloadHtml}>⬇ .html</button>
        <button className="fmt-btn" onClick={() => setInput('')}>✕ Clear</button>
        <button className="fmt-btn" onClick={() => setInput(SAMPLE)}>↺ Sample</button>
        <CopyBtn text={input} />
      </div>
      <p style={{ fontSize: '.72rem', color: 'var(--text2)', margin: '0 0 10px' }}>
        ⬇ PDF exports directly (no date/URL headers, theme + colors baked in). 🖨 Print uses the
        browser dialog — uncheck <em>Headers and footers</em> and tick <em>Background graphics</em> there.
      </p>
      <div className="md-split">
        <textarea
          className="fmt-textarea md-editor"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type Markdown…"
          aria-label="Markdown source"
        />
        <div ref={previewRef} className={pdfTheme === 'dark' ? 'md-preview md-preview-dark' : 'md-preview'} aria-label="Live preview">
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
      <style>{`.md-split{display:grid;grid-template-columns:1fr 1fr;gap:12px}.md-editor{min-height:420px;font-family:'JetBrains Mono',monospace}.md-preview{border:1px solid var(--border);border-radius:10px;padding:16px 20px;overflow:auto;max-height:70vh;background:var(--surface);line-height:1.65;overflow-wrap:break-word}.md-preview>:first-child{margin-top:0}.md-preview>:last-child{margin-bottom:0}.md-preview h1,.md-preview h2{border-bottom:1px solid var(--border);padding-bottom:.3em}.md-preview blockquote{border-left:3px solid var(--border2,#ccc);margin:1em 0;padding:.2rem 0 .2rem 1rem;color:var(--text2);background:var(--amber-dim,transparent);border-radius:0 8px 8px 0}.md-preview blockquote>:first-child{margin-top:0}.md-preview blockquote>:last-child{margin-bottom:0}.md-preview hr{border:none;border-top:1px solid var(--border);margin:1.5em 0}.md-preview ul{list-style:disc;padding-left:1.5em;margin:1em 0}.md-preview ol{list-style:decimal;padding-left:1.5em;margin:1em 0}.md-preview li{margin:.25em 0}.md-preview li>ul,.md-preview li>ol{margin:.25em 0}.md-preview ul ul{list-style-type:circle}.md-preview ul ul ul{list-style-type:square}.md-preview ul.contains-task-list{list-style:none;padding-left:0}.md-preview ul.contains-task-list input[type=checkbox]{margin-right:.5em;accent-color:var(--green,#22c55e)}.md-preview table{border-collapse:collapse;width:100%;display:block;overflow:auto}.md-preview th,.md-preview td{border:1px solid var(--border);padding:6px 10px}.md-preview tr:nth-child(even){background:rgba(127,127,127,.08)}.md-preview pre{background:rgba(127,127,127,.12);padding:12px;border-radius:8px;overflow:auto}.md-preview code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.85em;background:rgba(127,127,127,.15);padding:.15em .35em;border-radius:4px}.md-preview pre code{background:none;padding:0}.md-preview .hljs{color:var(--code-fg);background:none}.md-preview .hljs-keyword,.md-preview .hljs-selector-tag{color:var(--kw)}.md-preview .hljs-string,.md-preview .hljs-regexp{color:var(--str)}.md-preview .hljs-number,.md-preview .hljs-literal{color:var(--num)}.md-preview .hljs-title,.md-preview .hljs-title-function_{color:var(--fn)}.md-preview .hljs-comment,.md-preview .hljs-quote{color:var(--cmt);font-style:italic}.md-preview .hljs-name{color:var(--green)}.md-preview .hljs-attr,.md-preview .hljs-attribute,.md-preview .hljs-variable{color:var(--var-c)}.md-preview .hljs-built_in{color:var(--purple)}.md-preview .hljs-addition{color:var(--green)}.md-preview .hljs-deletion{color:var(--red)}.md-preview .hljs-emphasis{font-style:italic}.md-preview .hljs-strong{font-weight:700}.md-preview img{max-width:100%;height:auto;border-radius:6px}.md-preview details{border:1px solid var(--border);border-radius:8px;padding:.6rem 1rem;margin:1em 0}.md-preview summary{cursor:pointer;font-weight:600}.md-preview kbd{background:rgba(127,127,127,.15);border:1px solid var(--border);border-bottom-width:2px;border-radius:4px;padding:.1em .4em;font-size:.85em}.md-preview mark{background:#fff8c5;color:#111;padding:.1em .2em;border-radius:3px}.md-preview .footnotes{font-size:.85em;color:var(--text2);border-top:1px solid var(--border);margin-top:2em}.md-preview .footnotes ol{padding-left:1.5em}.md-preview .footnote-backref,.md-preview .data-footnote-backref{text-decoration:none}.md-preview .katex-display{overflow:auto;padding:.5em 0}.md-preview .katex{font-size:1.05em}.md-mermaid{display:flex;justify-content:center;padding:8px 0}.md-mermaid svg{max-width:100%;height:auto}.md-mermaid-err{color:var(--red);white-space:pre-wrap}@media(max-width:900px){.md-split{grid-template-columns:1fr}}.md-preview.md-preview-dark{background:#0b1220;color:#e2e8f0;border-color:#1e293b}.md-preview.md-preview-dark h1{color:#f8fafc;border-bottom:3px solid #22c55e}.md-preview.md-preview-dark h2{color:#6ee7b7;border-color:#14532d}.md-preview.md-preview-dark h3,.md-preview.md-preview-dark h4{color:#5eead4}.md-preview.md-preview-dark a{color:#7dd3fc}.md-preview.md-preview-dark blockquote{background:#111c33;border:1px solid #1e293b;border-left:4px solid #22c55e;color:#cbd5e1}.md-preview.md-preview-dark pre{background:#020617;color:#e2e8f0;border:1px solid #1e293b}.md-preview.md-preview-dark pre code{color:inherit;background:none}.md-preview.md-preview-dark code{background:#1e293b;color:#fbbf24}.md-preview.md-preview-dark th{background:#14532d;color:#dcfce7;border-color:#334155}.md-preview.md-preview-dark td{border-color:#334155}.md-preview.md-preview-dark tr:nth-child(even){background:#111c33}.md-preview.md-preview-dark hr{border-top:2px solid #164e3f}.md-preview.md-preview-dark mark{background:#facc15;color:#111}.md-preview.md-preview-dark kbd{background:#1e293b;border-color:#334155;color:#e2e8f0}.md-preview.md-preview-dark details{border-color:#334155;background:#0f172a}.md-preview.md-preview-dark .hljs{color:#e2e8f0}.md-preview.md-preview-dark .hljs-keyword,.md-preview.md-preview-dark .hljs-selector-tag{color:#ff7b72}.md-preview.md-preview-dark .hljs-string,.md-preview.md-preview-dark .hljs-regexp{color:#a5d6ff}.md-preview.md-preview-dark .hljs-number,.md-preview.md-preview-dark .hljs-literal{color:#79c0ff}.md-preview.md-preview-dark .hljs-title,.md-preview.md-preview-dark .hljs-title-function_{color:#d2a8ff}.md-preview.md-preview-dark .hljs-comment,.md-preview.md-preview-dark .hljs-quote{color:#8b949e}.md-preview.md-preview-dark .hljs-name{color:#7ee787}.md-preview.md-preview-dark .hljs-attr,.md-preview.md-preview-dark .hljs-attribute,.md-preview.md-preview-dark .hljs-variable{color:#79c0ff}.md-preview.md-preview-dark .hljs-built_in{color:#ffa657}.md-preview.md-preview-dark .md-mermaid svg{background:#fff;border-radius:10px;padding:6px}@media print{@page{margin:15mm 13mm}body{background:#fff!important}body *{visibility:hidden}.md-preview,.md-preview *{visibility:visible;-webkit-print-color-adjust:exact;print-color-adjust:exact}.md-preview{position:absolute;inset:0;max-height:none;border:none;border-radius:0;background:#fff!important;color:#111;overflow:visible;padding:0 4px;line-height:1.65}.md-split{display:block}.md-editor,.fmt-btns,.fmt-btn,.fmt-input{display:none!important}.md-preview h1{font-size:1.9rem;color:#0f172a;border-bottom:3px solid #22c55e;padding-bottom:.3em}.md-preview h2{color:#166534;border-bottom:1px solid #bbf7d0;padding-bottom:.3em}.md-preview h3,.md-preview h4{color:#0f766e}.md-preview a{color:#2563eb}.md-preview blockquote{background:#f0fdf4!important;border:1px solid #bbf7d0;border-left:4px solid #22c55e;border-radius:0 10px 10px 0;color:#334155;padding:.6rem 1rem}.md-preview pre{background:#0f172a!important;color:#e2e8f0;border:1px solid #1e293b;border-radius:10px;padding:1rem}.md-preview pre code{color:inherit;background:none}.md-preview code{background:#f1f5f9;color:#be123c}.md-preview .hljs{color:#e2e8f0;background:none}.md-preview .hljs-keyword,.md-preview .hljs-selector-tag{color:#ff7b72}.md-preview .hljs-string,.md-preview .hljs-regexp{color:#a5d6ff}.md-preview .hljs-number,.md-preview .hljs-literal{color:#79c0ff}.md-preview .hljs-title,.md-preview .hljs-title-function_{color:#d2a8ff}.md-preview .hljs-comment,.md-preview .hljs-quote{color:#8b949e;font-style:italic}.md-preview .hljs-name{color:#7ee787}.md-preview .hljs-attr,.md-preview .hljs-attribute,.md-preview .hljs-variable{color:#79c0ff}.md-preview .hljs-built_in{color:#ffa657}.md-preview mark{background:#fff8c5!important;color:#111}.md-preview th{background:#dcfce7!important;color:#14532d}.md-preview tr:nth-child(even){background:#f8fafc}.md-preview hr{border-top:2px solid #bbf7d0}.md-preview pre,.md-preview table,.md-preview blockquote,.md-preview details,.md-preview .md-mermaid{break-inside:avoid}.md-preview h1,.md-preview h2,.md-preview h3{break-after:avoid}.md-preview thead{display:table-header-group}body.md-pdf-dark{background:#0b1220!important}body.md-pdf-dark .md-preview{background:#0b1220!important;color:#e2e8f0}body.md-pdf-dark .md-preview h1{color:#f8fafc;border-bottom:3px solid #22c55e}body.md-pdf-dark .md-preview h2{color:#6ee7b7;border-color:#14532d}body.md-pdf-dark .md-preview h3,body.md-pdf-dark .md-preview h4{color:#5eead4}body.md-pdf-dark .md-preview a{color:#7dd3fc}body.md-pdf-dark .md-preview blockquote{background:#111c33!important;border:1px solid #1e293b;border-left:4px solid #22c55e;color:#cbd5e1}body.md-pdf-dark .md-preview pre{background:#020617!important;color:#e2e8f0;border:1px solid #1e293b}body.md-pdf-dark .md-preview pre code{color:inherit;background:none}body.md-pdf-dark .md-preview code{background:#1e293b;color:#fbbf24}body.md-pdf-dark .md-preview .hljs{color:#e2e8f0;background:none}body.md-pdf-dark .md-preview .hljs-keyword,body.md-pdf-dark .md-preview .hljs-selector-tag{color:#ff7b72}body.md-pdf-dark .md-preview .hljs-string,body.md-pdf-dark .md-preview .hljs-regexp{color:#a5d6ff}body.md-pdf-dark .md-preview .hljs-number,body.md-pdf-dark .md-preview .hljs-literal{color:#79c0ff}body.md-pdf-dark .md-preview .hljs-title,body.md-pdf-dark .md-preview .hljs-title-function_{color:#d2a8ff}body.md-pdf-dark .md-preview .hljs-comment,body.md-pdf-dark .md-preview .hljs-quote{color:#8b949e}body.md-pdf-dark .md-preview .hljs-name{color:#7ee787}body.md-pdf-dark .md-preview .hljs-attr,body.md-pdf-dark .md-preview .hljs-attribute,body.md-pdf-dark .md-preview .hljs-variable{color:#79c0ff}body.md-pdf-dark .md-preview .hljs-built_in{color:#ffa657}body.md-pdf-dark .md-preview th{background:#14532d!important;color:#dcfce7;border-color:#334155}body.md-pdf-dark .md-preview td{border-color:#334155}body.md-pdf-dark .md-preview tr:nth-child(even){background:#111c33}body.md-pdf-dark .md-preview hr{border-top:2px solid #164e3f}body.md-pdf-dark .md-preview mark{background:#facc15!important;color:#111}body.md-pdf-dark .md-preview kbd{background:#1e293b;border-color:#334155;color:#e2e8f0}body.md-pdf-dark .md-preview details{border-color:#334155}body.md-pdf-dark .md-preview .md-mermaid svg{background:#fff;border-radius:10px;padding:6px}}`}</style>
    </Shell>
  );
}

export default MarkdownPanel;
