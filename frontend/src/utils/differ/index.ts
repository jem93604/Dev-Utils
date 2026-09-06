import { lazy } from 'react';
import { defineUtil } from '../types';

export const differUtil = defineUtil({
  slug: 'differ',
  title: 'SQL Differ',
  icon: '🔄',
  description: 'Line-by-line diff of two queries',
  route: '/differ',
  category: 'format',
  keywords: ['diff', 'sql', 'compare', 'query'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.DifferPanel }))),
});
