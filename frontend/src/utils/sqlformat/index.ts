import { lazy } from 'react';
import { defineUtil } from '../types';

export const sqlformatUtil = defineUtil({
  slug: 'sqlformat',
  title: 'SQL Formatter',
  icon: '✨',
  description: 'Prettify SQL: keyword case, clause breaks, indent',
  route: '/utils/sqlformat',
  category: 'sql',
  keywords: ['sql', 'format', 'prettify', 'indent', 'query'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.SqlFormatPanel }))),
});
