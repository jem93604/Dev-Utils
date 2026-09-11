import { lazy } from 'react';
import { defineUtil } from '../types';

export const linksaverUtil = defineUtil({
  slug: 'linksaver',
  title: 'Link Saver',
  icon: '🔗',
  description: 'Save public videos via Cobalt, yt-dlp fallback (720p default)',
  route: '/utils/linksaver',
  category: 'gen',
  keywords: ['video', 'download', 'youtube', 'tiktok', 'twitter', 'cobalt', 'ytdlp'],
  component: lazy(() => import('./Panel').then((m) => ({ default: m.LinkSaverPanel }))),
});
