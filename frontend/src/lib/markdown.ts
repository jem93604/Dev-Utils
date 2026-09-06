// Pure helpers for the Markdown Preview util (vitest-covered).

export function extractMermaidBlocks(src: string): string[] {
  const out: string[] = [];
  const re = /```mermaid\s*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1].trim());
  return out;
}

const EXPORT_CSS = `body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#111}pre{background:#f4f4f5;padding:1rem;border-radius:8px;overflow:auto}code{font-family:'JetBrains Mono',monospace;font-size:.85em}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 10px}blockquote{border-left:3px solid #ccc;margin:0;padding-left:1rem;color:#555}`;

function escapeTitle(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildHtmlExport(bodyHtml: string, title = 'Markdown export'): string {
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>${escapeTitle(title)}</title>\n<style>${EXPORT_CSS}</style>\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>`;
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
