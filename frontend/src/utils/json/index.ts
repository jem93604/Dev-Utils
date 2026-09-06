import { lazy } from 'react';
import { defineUtil } from '../types';

export const jsonUtil = defineUtil({
  slug: 'json',
  title: 'JSON Formatter',
  icon: '🧾',
  description: 'Pretty/minify/validate + accessor builder',
  route: '/utils/json',
  category: 'format',
  keywords: ['json', 'pretty', 'minify', 'validate', 'format', 'postgres'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.JsonPanel }))),
});
