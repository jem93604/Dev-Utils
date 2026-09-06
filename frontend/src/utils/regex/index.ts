import { lazy } from 'react';
import { defineUtil } from '../types';

export const regexUtil = defineUtil({
  slug: 'regex',
  title: 'Regex Tester',
  icon: '🔍',
  description: 'Live pattern matching with flags',
  route: '/utils/regex',
  category: 'text',
  keywords: ['regex', 'pattern', 'match', 'flags', 'test', 'regexp'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.RegexPanel }))),
});
