import { lazy } from 'react';
import { defineUtil } from '../types';

export const textUtil = defineUtil({
  slug: 'text',
  title: 'Text Toolkit',
  icon: '🔤',
  description: 'Case, counts, whitespace cleanup, Lorem',
  route: '/utils/text',
  category: 'text',
  keywords: ['text', 'case', 'words', 'whitespace', 'lorem', 'count'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.TextPanel }))),
});
