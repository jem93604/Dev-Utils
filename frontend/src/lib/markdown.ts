// Pure helpers for the Markdown Preview util (vitest-covered).

export function extractMermaidBlocks(src: string): string[] {
  const out: string[] = [];
  const re = /```mermaid\s*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1].trim());
  return out;
}

/**
 * Convert LaTeX \(...\) / \[...\] delimiters to $...$ / $$...$$ so
 * remark-math + rehype-katex render them. Fenced code blocks and inline
 * code spans are left untouched.
 */
export function normalizeMathDelimiters(src: string): string {
  const fenceParts = src.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~)/g);
  return fenceParts
    .map((part, i) => {
      if (i % 2 === 1) return part; // fenced code — leave alone
      return part
        .split(/(`[^`\n]*`)/g)
        .map((seg, j) => {
          if (j % 2 === 1) return seg; // inline code — leave alone
          return seg
            .replace(/(?<!\\)\\\[([\s\S]+?)(?<!\\)\\\]/g, (_m: string, inner: string) => `$$${inner.trim()}$$`)
            .replace(/(?<!\\)\\\(([^()\n]+?)(?<!\\)\\\)/g, (_m: string, inner: string) => `$${inner}$`);
        })
        .join('');
    })
    .join('');
}

const EXPORT_CSS = `body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;line-height:1.65;color:#111;word-wrap:break-word}h1,h2{border-bottom:1px solid #e5e7eb;padding-bottom:.3em}blockquote{border-left:3px solid #ccc;margin:0;padding:.2rem 0 .2rem 1rem;color:#555}blockquote>:first-child{margin-top:0}blockquote>:last-child{margin-bottom:0}hr{border:none;border-top:1px solid #e5e7eb;margin:1.5em 0}ul{list-style:disc;padding-left:1.5em;margin:1em 0}ol{list-style:decimal;padding-left:1.5em;margin:1em 0}li{margin:.25em 0}li>ul,li>ol{margin:.25em 0}ul ul{list-style-type:circle}ul ul ul{list-style-type:square}ul.contains-task-list{list-style:none;padding-left:0}ul.contains-task-list input[type=checkbox]{margin-right:.5em}pre{background:#f4f4f5;padding:1rem;border-radius:8px;overflow:auto}code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.85em;background:rgba(127,127,127,.15);padding:.15em .35em;border-radius:4px}pre code{background:none;padding:0}.hljs{color:#1f2328;background:none}.hljs-keyword,.hljs-selector-tag{color:#cf222e}.hljs-string,.hljs-regexp{color:#0a3069}.hljs-number,.hljs-literal{color:#0550ae}.hljs-title,.hljs-title-function_{color:#6639ba}.hljs-comment,.hljs-quote{color:#6e7781;font-style:italic}.hljs-name,.hljs-selector-id,.hljs-selector-class{color:#116329}.hljs-attr,.hljs-attribute,.hljs-variable,.hljs-template-variable{color:#953800}.hljs-built_in,.hljs-builtin-name{color:#8250df}.hljs-addition{color:#116329;background:#dafbe1}.hljs-deletion{color:#82071e;background:#ffebe9}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}table{border-collapse:collapse;width:100%;display:block;overflow:auto}th,td{border:1px solid #ddd;padding:6px 10px}tr:nth-child(even){background:#f8fafc}img{max-width:100%;height:auto;border-radius:6px}details{border:1px solid #e5e7eb;border-radius:8px;padding:.6rem 1rem;margin:1em 0}summary{cursor:pointer;font-weight:600}kbd{background:#f4f4f5;border:1px solid #ddd;border-bottom-width:2px;border-radius:4px;padding:.1em .4em;font-size:.85em}mark{background:#fff8c5;padding:.1em .2em;border-radius:3px}.footnotes{font-size:.85em;color:#444;border-top:1px solid #e5e7eb;margin-top:2em}.footnotes ol{padding-left:1.5em}.footnote-backref,.data-footnote-backref{text-decoration:none}.katex-display{overflow:auto;padding:.5em 0}.katex{font-size:1.05em}.md-mermaid{display:flex;justify-content:center;padding:8px 0}.md-mermaid svg{max-width:100%;height:auto}a{color:#2563eb}h1{font-size:2rem;color:#0f172a;border-bottom:3px solid #22c55e}h2{color:#166534;border-bottom-color:#bbf7d0}h3,h4{color:#0f766e}blockquote{background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #22c55e;border-radius:0 10px 10px 0;padding:.6rem 1rem;color:#334155}pre{background:#0f172a;color:#e2e8f0;border:1px solid #1e293b;border-radius:10px}pre code{color:inherit}code{background:#f1f5f9;color:#be123c}th{background:#dcfce7;color:#14532d}hr{border-top:2px solid #bbf7d0}.export-head{border-bottom:3px solid #22c55e;padding-bottom:.6rem;margin-bottom:1.5rem}.export-head h1{border:none !important;padding:0 !important;margin:0 0 .2rem;font-size:1.9rem;color:#0f172a}.export-head p{margin:0;color:#64748b;font-size:.85rem}@page{margin:15mm 13mm}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}pre,table,blockquote,details,.md-mermaid{break-inside:avoid}h1,h2,h3{break-after:avoid}thead{display:table-header-group}
}`;

/** PDF/HTML export theme for the Markdown util. */
export type ExportTheme = 'light' | 'dark';

/* Dark-theme overrides for the standalone HTML export (appended after EXPORT_CSS). */
const EXPORT_DARK_CSS = `body.export-dark{background:#0b1220;color:#e2e8f0}body.export-dark h1{color:#f8fafc;border-bottom:3px solid #22c55e}body.export-dark h2{color:#6ee7b7;border-bottom-color:#14532d}body.export-dark h3,body.export-dark h4{color:#5eead4}body.export-dark a{color:#7dd3fc}body.export-dark blockquote{background:#111c33;border:1px solid #1e293b;border-left:4px solid #22c55e;color:#cbd5e1}body.export-dark pre{background:#020617;color:#e2e8f0;border:1px solid #1e293b}body.export-dark code{background:#1e293b;color:#fbbf24}body.export-dark pre code{background:none;color:inherit}body.export-dark .hljs{color:#e2e8f0;background:none}body.export-dark .hljs-keyword,body.export-dark .hljs-selector-tag{color:#ff7b72}body.export-dark .hljs-string,body.export-dark .hljs-regexp{color:#a5d6ff}body.export-dark .hljs-number,body.export-dark .hljs-literal{color:#79c0ff}body.export-dark .hljs-title,body.export-dark .hljs-title-function_{color:#d2a8ff}body.export-dark .hljs-comment,body.export-dark .hljs-quote{color:#8b949e;font-style:italic}body.export-dark .hljs-name{color:#7ee787}body.export-dark .hljs-attr,body.export-dark .hljs-attribute,body.export-dark .hljs-variable{color:#79c0ff}body.export-dark .hljs-built_in{color:#ffa657}body.export-dark th{background:#14532d;color:#dcfce7}body.export-dark th,body.export-dark td{border-color:#334155}body.export-dark tr:nth-child(even){background:#111c33}body.export-dark hr{border-top:2px solid #164e3f}body.export-dark kbd{background:#1e293b;border-color:#334155;color:#e2e8f0}body.export-dark mark{background:#facc15;color:#111}body.export-dark details{border-color:#334155;background:#0f172a}body.export-dark .export-head h1{color:#f8fafc}body.export-dark .export-head{border-color:#22c55e}body.export-dark .export-head p{color:#94a3b8}body.export-dark .md-mermaid svg{background:#fff;border-radius:10px;padding:6px}body.export-dark img{border:1px solid #1e293b}`;

/**
 * Scoped stylesheet for the direct in-JS PDF export. Every rule is nested
 * under `.export-doc` so the off-screen render host can't leak styles into
 * the app, and `@page` is dropped (print-dialog only). The host element must
 * carry `export-doc` (+ `export-dark` for the dark theme).
 */
export function getExportCss(theme: ExportTheme = 'light'): string {
  const raw = theme === 'dark' ? EXPORT_CSS + EXPORT_DARK_CSS : EXPORT_CSS;
  return raw
    .replace(/@page\{[^}]*\}/g, '')
    .replace(/\bbody\.export-dark\b/g, '.export-doc.export-dark')
    .replace(/\bbody\b(?![\w-])/g, '.export-doc')
    .split('}')
    .map((chunk) => {
      const i = chunk.indexOf('{');
      if (i === -1) return '';
      const sel = chunk.slice(0, i).trim();
      const decl = chunk.slice(i);
      if (!sel || sel.startsWith('@') || sel.startsWith('.export-doc')) return `${sel}${decl}}`;
      const scoped = sel
        .split(',')
        .map((s) => `.export-doc ${s.trim()}`)
        .join(',');
      return `${scoped}${decl}}`;
    })
    .join('');
}

export function escapeTitle(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildHtmlExport(
  bodyHtml: string,
  title = 'Markdown export',
  theme: ExportTheme = 'light',
): string {
  const safe = escapeTitle(title.trim() || 'Markdown export');
  const scheme = theme === 'dark' ? 'dark' : 'light';
  const bodyCls = theme === 'dark' ? ' class="export-dark"' : '';
  const themeCss = theme === 'dark' ? EXPORT_DARK_CSS : '';
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<meta name="color-scheme" content="${scheme}">\n<title>${safe}</title>\n<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">\n<style>${EXPORT_CSS}${themeCss}</style>\n</head>\n<body${bodyCls}>\n${bodyHtml}\n</body>\n</html>`;
}

export function downloadTextFile(filename: string, text: string, mime = 'text/plain'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
