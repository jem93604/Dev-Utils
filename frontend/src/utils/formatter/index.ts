import { lazy } from 'react';
import { defineUtil } from '../types';

export const formatterUtil = defineUtil({
  slug: 'formatter',
  title: 'Data Formatter',
  icon: '🛠',
  description: 'Lists to SQL IN(...), CSV, UPPER/lower, dedup',
  route: '/formatter',
  category: 'format',
  keywords: ['formatter', 'sql', 'csv', 'dedup', 'case', 'list'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.FormatterPanel }))),
});
