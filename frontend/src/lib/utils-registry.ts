// Utility registry — single source of truth for metadata.
// Each util lives in src/utils/<slug>/ (Panel.tsx + index.ts via defineUtil).
// To add a utility: create src/utils/<slug>/ + append its UtilModule below.
// Hub, sidebar, topbar favorites, and Ctrl+K palette render from ALL_UTILS.

import type { UtilModule } from '../utils/types';
import { timeUtil } from '../utils/time';
import { jsonUtil } from '../utils/json';
import { codecUtil } from '../utils/codec';
import { jwtUtil } from '../utils/jwt';
import { uuidUtil } from '../utils/uuid';
import { regexUtil } from '../utils/regex';
import { baseUtil } from '../utils/base';
import { yamlUtil } from '../utils/yaml';
import { textUtil } from '../utils/text';
import { formatterUtil } from '../utils/formatter';
import { differUtil } from '../utils/differ';
import { notesUtil } from '../utils/notes';
import { libraryUtil } from '../utils/library';
import { markdownUtil } from '../utils/markdown';
import { hashUtil } from '../utils/hash';
import { cronUtil } from '../utils/cron';
import { urlcodecUtil } from '../utils/urlcodec';
import { sqlformatUtil } from '../utils/sqlformat';
import { mockrowsUtil } from '../utils/mockrows';
import { wherebuilderUtil } from '../utils/wherebuilder';
import { connstrUtil } from '../utils/connstr';

export interface UtilDef {
  slug: string;
  title: string;
  icon: string;
  description: string;
  route: string;
}

export const ALL_UTILS: UtilModule[] = [
  formatterUtil,
  differUtil,
  notesUtil,
  libraryUtil,
  markdownUtil,
  timeUtil,
  jsonUtil,
  codecUtil,
  jwtUtil,
  uuidUtil,
  regexUtil,
  baseUtil,
  yamlUtil,
  textUtil,
  hashUtil,
  cronUtil,
  urlcodecUtil,
  sqlformatUtil,
  mockrowsUtil,
  wherebuilderUtil,
  connstrUtil,
];

export const UTILS: UtilDef[] = ALL_UTILS.map((u) => ({
  slug: u.slug,
  title: u.title,
  icon: u.icon,
  description: u.description,
  route: u.route,
}));

export function utilBySlug(slug: string): UtilDef | undefined {
  return UTILS.find((u) => u.slug === slug);
}

export function utilModuleBySlug(slug: string): UtilModule | undefined {
  return ALL_UTILS.find((u) => u.slug === slug);
}

export const UTIL_COMPONENTS: Record<string, UtilModule['component']> = Object.fromEntries(
  ALL_UTILS.map((u) => [u.slug, u.component]),
);

export const UTIL_META_PATCH: Record<string, Pick<UtilModule, 'category' | 'keywords'>> = Object.fromEntries(
  ALL_UTILS.map((u) => [u.slug, { category: u.category, keywords: u.keywords }]),
);
