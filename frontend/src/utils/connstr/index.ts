import { lazy } from 'react';
import { defineUtil } from '../types';

export const connstrUtil = defineUtil({
  slug: 'connstr',
  title: 'Connection-String Parser',
  icon: '🔌',
  description: 'Break down Postgres/SQLite URLs into fields',
  route: '/utils/connstr',
  category: 'sql',
  keywords: ['postgres', 'sqlite', 'connection', 'database url', 'dsn'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.ConnStrPanel }))),
});
