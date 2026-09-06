import { lazy } from 'react';
import { defineUtil } from '../types';

export const timeUtil = defineUtil({
  slug: 'time',
  title: 'Time Converter',
  icon: '🕒',
  description: 'Epoch ↔ date, IST/UTC/local, Postgres snippets',
  route: '/utils/time',
  category: 'time',
  keywords: ['epoch', 'unix', 'ist', 'utc', 'postgres', 'date'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.TimePanel }))),
});
