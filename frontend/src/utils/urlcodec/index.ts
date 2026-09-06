import { lazy } from 'react';
import { defineUtil } from '../types';

export const urlcodecUtil = defineUtil({
  slug: 'urlcodec',
  title: 'URL Codec',
  icon: '🔗',
  description: 'Encode/decode URLs, split + rebuild query params',
  route: '/utils/urlcodec',
  category: 'encode',
  keywords: ['url', 'encode', 'decode', 'query', 'params', 'percent'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.UrlCodecPanel }))),
});
