import { lazy } from 'react';
import { defineUtil } from '../types';

export const codecUtil = defineUtil({
  slug: 'codec',
  title: 'Base64 + URL Codec',
  icon: '🔣',
  description: 'Encode/decode Base64 and URL-encoding',
  route: '/utils/codec',
  category: 'encode',
  keywords: ['base64', 'url', 'encode', 'decode', 'codec', 'escape'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.CodecPanel }))),
});
