import { describe, expect, it } from 'vitest';
import { buildHtmlExport, extractMermaidBlocks } from './markdown';

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
});
