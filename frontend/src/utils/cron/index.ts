import { lazy } from 'react';
import { defineUtil } from '../types';

export const cronUtil = defineUtil({
  slug: 'cron',
  title: 'Cron Parser',
  icon: '⏰',
  description: 'Parse cron expressions, next runs in plain English',
  route: '/utils/cron',
  category: 'time',
  keywords: ['cron', 'schedule', 'schedule', 'recurrence', 'job', 'timer'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.CronPanel }))),
});
