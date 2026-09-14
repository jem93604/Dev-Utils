import { describe, expect, it } from 'vitest';
import { buildHtmlExport, extractMermaidBlocks, getExportCss, normalizeMathDelimiters } from './markdown';

describe('extractMermaidBlocks', () => {
  it('extracts mermaid code fences', () => {
    const src = '# Hi\n\n```mermaid\ngraph TD\nA-->B\n```\n\ntext';
    const blocks = extractMermaidBlocks(src);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('graph TD');
  });
  it('returns empty when no mermaid blocks', () => {
    expect(extractMermaidBlocks('# Hi\n\n```js\n1+1\n```')).toHaveLength(0);
  });
});

describe('buildHtmlExport', () => {
  it('wraps rendered html in a standalone document', () => {
    const out = buildHtmlExport('<h1>Hi</h1>', 'Test');
    expect(out).toContain('<!doctype html>');
    expect(out).toContain('<h1>Hi</h1>');
    expect(out).toContain('<title>Test</title>');
  });
  it('includes katex css for math exports', () => {
    expect(buildHtmlExport('<p>x</p>')).toContain('katex.min.css');
  });
  it('applies the dark theme when requested', () => {
    const out = buildHtmlExport('<p>x</p>', 'T', 'dark');
    expect(out).toContain('class="export-dark"');
    expect(out).toContain('color-scheme" content="dark"');
  });
});

describe('getExportCss', () => {
  it('scopes bare element selectors under .export-doc and drops @page', () => {
    const css = getExportCss('light');
    expect(css).toContain('.export-doc h1');
    expect(css).toContain('.export-doc pre');
    expect(css).not.toContain('@page');
    expect(css).not.toMatch(/(^|})body\{/);
  });
  it('maps the dark body class onto the export host', () => {
    const css = getExportCss('dark');
    expect(css).toContain('.export-doc.export-dark h1');
    expect(css).toContain('.export-doc.export-dark pre');
  });
});

describe('normalizeMathDelimiters', () => {
  it('converts \\( \\) to dollar inline math', () => {
    expect(normalizeMathDelimiters('Inline math: \\(E = mc^2\\) end')).toContain('$E = mc^2$');
  });
  it('converts \\[ \\] to display math', () => {
    const out = normalizeMathDelimiters('Block:\\n\\[\\n\\\\int_0^1 x^2 dx\\n\\]');
    expect(out).toContain('$$');
  });
  it('leaves fenced code blocks untouched', () => {
    const src = '```tex\n\\(not math\\)\n```\n\n\\(real\\)';
    const out = normalizeMathDelimiters(src);
    expect(out).toContain('\\(not math\\)');
    expect(out).toContain('$real$');
  });
  it('leaves inline code spans untouched', () => {
    const out = normalizeMathDelimiters('`\\(x\\)` and \\(y\\)');
    expect(out).toContain('`\\(x\\)`');
    expect(out).toContain('$y$');
  });
});
