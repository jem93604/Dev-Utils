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

const EXPORT_CSS = `body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;line-height:1.65;color:#111;word-wrap:break-word}h1,h2{border-bottom:1px solid #e5e7eb;padding-bottom:.3em}blockquote{border-left:3px solid #ccc;margin:0;padding:.2rem 0 .2rem 1rem;color:#555}blockquote>:first-child{margin-top:0}blockquote>:last-child{margin-bottom:0}hr{border:none;border-top:1px solid #e5e7eb;margin:1.5em 0}ul{list-style:disc;padding-left:1.5em;margin:1em 0}ol{list-style:decimal;padding-left:1.5em;margin:1em 0}li{margin:.25em 0}li>ul,li>ol{margin:.25em 0}ul ul{list-style-type:circle}ul ul ul{list-style-type:square}ul.contains-task-list{list-style:none;padding-left:0}ul.contains-task-list input[type=checkbox]{margin-right:.5em}pre{background:#f4f4f5;padding:1rem;border-radius:8px;overflow:auto}code{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:.85em;background:rgba(127,127,127,.15);padding:.15em .35em;border-radius:4px}pre code{background:none;padding:0}.hljs{color:#1f2328;background:none}.hljs-keyword,.hljs-selector-tag{color:#cf222e}.hljs-string,.hljs-regexp{color:#0a3069}.hljs-number,.hljs-literal{color:#0550ae}.hljs-title,.hljs-title-function_{color:#6639ba}.hljs-comment,.hljs-quote{color:#6e7781;font-style:italic}.hljs-name,.hljs-selector-id,.hljs-selector-class{color:#116329}.hljs-attr,.hljs-attribute,.hljs-variable,.hljs-template-variable{color:#953800}.hljs-built_in,.hljs-builtin-name{color:#8250df}.hljs-addition{color:#116329;background:#dafbe1}.hljs-deletion{color:#82071e;background:#ffebe9}.hljs-emphasis{font-style:italic}.hljs-strong{font-weight:700}table{border-collapse:collapse;width:100%;display:block;overflow:auto}th,td{border:1px solid #ddd;padding:6px 10px}tr:nth-child(even){background:#f8fafc}img{max-width:100%;height:auto;border-radius:6px}details{border:1px solid #e5e7eb;border-radius:8px;padding:.6rem 1rem;margin:1em 0}summary{cursor:pointer;font-weight:600}kbd{background:#f4f4f5;border:1px solid #ddd;border-bottom-width:2px;border-radius:4px;padding:.1em .4em;font-size:.85em}mark{background:#fff8c5;padding:.1em .2em;border-radius:3px}.footnotes{font-size:.85em;color:#444;border-top:1px solid #e5e7eb;margin-top:2em}.footnotes ol{padding-left:1.5em}.footnote-backref,.data-footnote-backref{text-decoration:none}.katex-display{overflow:auto;padding:.5em 0}.katex{font-size:1.05em}.md-mermaid{display:flex;justify-content:center;padding:8px 0}.md-mermaid svg{max-width:100%;height:auto}a{color:#0969da}`;

function escapeTitle(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Strip dangerous constructs from rendered preview/export HTML.
 * The preview pipeline (rehype-raw) and mermaid both use innerHTML, and
 * buildHtmlExport inlines preview HTML into a file — so script tags,
 * event handlers, javascript: URLs, and form/action attributes must go.
 * Keep formatting tags (incl. <details>, <kbd>, <mark>) untouched.
 */
export function sanitizeRenderedHtml(html: string): string {
  let out = html.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
  out = out.replace(/<iframe[\s\S]*?<\/iframe\s*>/gi, '');
  out = out.replace(/<object[\s\S]*?<\/object\s*>/gi, '');
  out = out.replace(/<embed[^>]*>/gi, '');
  out = out.replace(/<form[\s\S]*?<\/form\s*>/gi, '');
  // event-handler attributes: onclick=, onerror=, ... (quoted or not)
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // javascript:/data:text/html URLs in href/src/action/xlink:href
  out = out.replace(
    /\s(href|src|action|xlink:href)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (m, _attr: string, _q: string, d1: string, d2: string, d3: string) => {
      const v = (d1 ?? d2 ?? d3 ?? '').trim().toLowerCase();
      if (v.startsWith('javascript:') || v.startsWith('data:text/html')) return '';
      return m;
    },
  );
  return out;
}

export function buildHtmlExport(bodyHtml: string, title = 'Markdown export'): string {
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${escapeTitle(title)}</title>\n<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">\n<style>${EXPORT_CSS}</style>\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>`;
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
