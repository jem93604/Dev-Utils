import { lazy } from 'react';
import { defineUtil } from '../types';

export const markdownUtil = defineUtil({
  slug: 'markdown',
  title: 'Markdown Preview',
  icon: '📝',
  description: 'Live GFM + Mermaid preview, print to PDF, export .md/.html',
  route: '/utils/markdown',
  category: 'text',
  keywords: ['markdown', 'preview', 'mermaid', 'pdf', 'gfm', 'export'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.MarkdownPanel }))),
});
