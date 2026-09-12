// imgcompress: pure, DOM-free helpers for the image compressor utility.
// Canvas encode/decode lives in Panel.tsx; everything here is unit-tested.

export type ResizeMode = 'max' | 'exact' | 'scale';
export type OutputFormat = 'keep' | 'jpeg' | 'png' | 'webp';

export interface Size {
  w: number;
  h: number;
}

/** Max single-file input size (protects tab memory). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** Max files per batch (sequential processing). */
export const MAX_FILES = 20;
/** Hard cap for exact-mode dimensions. */
export const MAX_DIM = 16384;

/** Quality ladder swept in Auto mode, highest quality first. */
export const AUTO_QUALITY_STEPS = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4, 0.3];
/** Bounds for the Target-KB binary search on encode quality. */
export const TARGET_MIN_Q = 0.05;
export const TARGET_MAX_Q = 0.95;
/** Iterations for the Target-KB binary search (fixed cost, no tuning needed). */
export const TARGET_STEPS = 7;

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

function assertPositiveInt(n: number, name: string): void {
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
}

/** Fit inside maxW×maxH preserving aspect ratio. Never upscales. */
export function computeFitSize(srcW: number, srcH: number, maxW: number, maxH: number): Size {
  assertPositiveInt(srcW, 'Source width');
  assertPositiveInt(srcH, 'Source height');
  assertPositiveInt(maxW, 'Max width');
  assertPositiveInt(maxH, 'Max height');
  if (srcW <= maxW && srcH <= maxH) return { w: srcW, h: srcH };
  const scale = Math.min(maxW / srcW, maxH / srcH);
  return {
    w: Math.max(1, Math.floor(srcW * scale)),
    h: Math.max(1, Math.floor(srcH * scale)),
  };
}

/** Exact W×H stretch (distortion + upscale allowed). Returns inputs verbatim. */
export function computeExactSize(exactW: number, exactH: number): Size {
  assertPositiveInt(exactW, 'Width');
  assertPositiveInt(exactH, 'Height');
  if (exactW > MAX_DIM || exactH > MAX_DIM) throw new Error(`Dimensions must be ≤ ${MAX_DIM}px`);
  return { w: exactW, h: exactH };
}

/** Scale source by percent (1–100, downscale only). Minimum 1px. */
export function computeScaleSize(srcW: number, srcH: number, pct: number): Size {
  assertPositiveInt(srcW, 'Source width');
  assertPositiveInt(srcH, 'Source height');
  if (!Number.isFinite(pct) || pct < 1 || pct > 100)
    throw new Error('Scale must be between 1 and 100%');
  return {
    w: Math.max(1, Math.round((srcW * pct) / 100)),
    h: Math.max(1, Math.round((srcH * pct) / 100)),
  };
}

/** Human-readable byte size (1024-based, 1 decimal). */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) throw new Error('Byte size must be a non-negative number');
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / 1024 ** i;
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** Savings percent: positive = smaller output. May be negative (output grew). */
export function savingsPct(origBytes: number, outBytes: number): number {
  if (!Number.isFinite(origBytes) || origBytes <= 0) throw new Error('Original size must be > 0');
  if (!Number.isFinite(outBytes) || outBytes < 0) throw new Error('Output size must be ≥ 0');
  return ((origBytes - outBytes) / origBytes) * 100;
}

export function mimeForFormat(origType: string, format: OutputFormat): string {
  switch (format) {
    case 'keep':
      if (!ALLOWED_MIME.has(origType)) throw new Error(`Unsupported image type "${origType || '(unknown)'}"`);
      return origType;
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
  }
}

export function extForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      throw new Error(`No extension for mime "${mime}"`);
  }
}

/** Rewrite the filename extension for the output mime. */
export function buildOutputFilename(origName: string, outMime: string): string {
  const base = origName.trim() || 'image';
  const stripped = base.includes('.') ? base.replace(/\.[^.]*$/, '') : base;
  return `${stripped || 'image'}${extForMime(outMime)}`;
}

/** Reject non-image / oversize files with a friendly message. */
export function validateImageFile(file: { type: string; size: number; name: string }): void {
  if (!ALLOWED_MIME.has(file.type))
    throw new Error(
      `"${file.name || 'file'}" is ${file.type || 'an unknown type'} — only PNG, JPEG, WebP are supported`,
    );
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error(`"${file.name}" looks empty`);
  if (file.size > MAX_FILE_BYTES)
    throw new Error(`"${file.name}" is ${formatBytes(file.size)} — max ${formatBytes(MAX_FILE_BYTES)} per file`);
}

export interface QualitySample {
  q: number;
  bytes: number;
}

/**
 * Pick the Auto quality: samples must be sorted highest-quality-first.
 * Returns the lowest quality where one step higher costs >10% extra bytes
 * (the knee — beyond it you pay bytes for no visible gain). Ties and flat
 * curves resolve toward the smaller file; an all-cheap ladder returns the
 * best quality.
 */
export function pickAutoQuality(samples: QualitySample[]): number {
  if (samples.length === 0) throw new Error('No quality samples');
  if (samples.length === 1) return samples[0].q;
  for (let i = samples.length - 1; i > 0; i--) {
    const cur = samples[i];
    const higher = samples[i - 1];
    if (cur.bytes <= 0 || higher.bytes <= 0) continue;
    if ((higher.bytes - cur.bytes) / cur.bytes > 0.1) return cur.q;
  }
  return samples[0].q;
}

/** One-line summary of the active settings (shown above results). */
export function describeSettings(opts: {
  mode: ResizeMode;
  format: OutputFormat;
  auto: boolean;
  manualQ: number;
  targetOn: boolean;
  targetKb: number;
}): string {
  const fmt = opts.format === 'keep' ? 'keep original' : opts.format.toUpperCase();
  const mode = opts.mode === 'max' ? 'max-fit' : opts.mode === 'exact' ? 'exact' : 'scale';
  if (opts.targetOn) return `${mode} → ${fmt}, target ≤ ${opts.targetKb} KB (overrides quality)`;
  const q = opts.auto ? 'auto quality' : `q${opts.manualQ.toFixed(2)}`;
  return `${mode} → ${fmt}, ${q}`;
}

export type BatchQualityMode = 'auto' | 'manual' | 'target';

export interface BatchQualityInput {
  auto: boolean;
  manualQ: number;
  targetOn: boolean;
  targetKb: number;
}

/** Single active quality path — target wins, then manual, else auto. */
export function resolveBatchQualityMode(input: BatchQualityInput): BatchQualityMode {
  if (input.targetOn) return 'target';
  if (!input.auto) return 'manual';
  return 'auto';
}

/** Display label for a batch quality sweep step (used above the results bar). */
export function batchQualityLabel(input: BatchQualityInput): string {
  const mode = resolveBatchQualityMode(input);
  if (mode === 'target') return `target ≤ ${Math.max(1, Math.floor(input.targetKb))} KB`;
  if (mode === 'manual') return `q${clampQuality(input.manualQ).toFixed(2)}`;
  return 'auto';
}

/** Clamp an arbitrary number into the encoder quality range. */
export function clampQuality(q: number): number {
  if (!Number.isFinite(q)) throw new Error('Quality must be a number');
  return Math.min(1, Math.max(TARGET_MIN_Q, q));
}

/**
 * Decide which files a batch-quality apply touches: skips files still
 * working, errored files without a source URL, and PNG outputs (lossless —
 * quality has no effect). Returns the ids to re-encode.
 */
export function batchQualityTargets(
  files: Array<{ id: string; status: string; origUrl: string; outMime?: string }>,
): string[] {
  return files
    .filter((f) => f.status !== 'working' && f.origUrl && f.outMime !== 'image/png')
    .map((f) => f.id);
}
