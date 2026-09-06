import { lazy } from 'react';
import { defineUtil } from '../types';

export const wherebuilderUtil = defineUtil({
  slug: 'wherebuilder',
  title: 'WHERE Builder',
  icon: '🧱',
  description: 'Click together AND/OR filters → parameterized SQL',
  route: '/utils/wherebuilder',
  category: 'sql',
  keywords: ['where', 'filter', 'sql', 'params', 'query builder'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.WhereBuilderPanel }))),
});
