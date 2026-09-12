import { describe, expect, it } from 'vitest';
import {
  AUTO_QUALITY_STEPS,
  TARGET_MAX_Q,
  TARGET_MIN_Q,
  batchQualityLabel,
  batchQualityTargets,
  buildOutputFilename,
  clampQuality,
  computeExactSize,
  computeFitSize,
  computeScaleSize,
  describeSettings,
  formatBytes,
  mimeForFormat,
  pickAutoQuality,
  resolveBatchQualityMode,
  savingsPct,
  shouldKeepOriginal,
  validateImageFile,
} from './lib';

describe('computeFitSize', () => {
  it('keeps small images as-is (never upscale)', () => {
    expect(computeFitSize(800, 600, 1920, 1920)).toEqual({ w: 800, h: 600 });
  });

  it('fits landscape into the box preserving aspect', () => {
    const s = computeFitSize(4000, 2000, 1920, 1080);
    expect(s.w).toBeLessThanOrEqual(1920);
    expect(s.h).toBeLessThanOrEqual(1080);
    expect(s.w / s.h).toBeCloseTo(2, 1);
  });

  it('fits portrait into the box preserving aspect', () => {
    const s = computeFitSize(1000, 4000, 500, 500);
    expect(s).toEqual({ w: 125, h: 500 });
  });

  it('rejects non-positive bounds', () => {
    expect(() => computeFitSize(100, 100, 0, 100)).toThrow();
    expect(() => computeFitSize(100, 100, 100, -5)).toThrow();
  });
});

describe('computeExactSize', () => {
  it('returns inputs verbatim (stretch, upscale allowed)', () => {
    expect(computeExactSize(300, 250)).toEqual({ w: 300, h: 250 });
    expect(computeExactSize(4000, 4000)).toEqual({ w: 4000, h: 4000 });
  });

  it('rejects zero, negative, and non-integers', () => {
    for (const [w, h] of [[0, 100], [100, 0], [-1, 50], [100.5, 100], [100, NaN]]) {
      expect(() => computeExactSize(w, h)).toThrow();
    }
  });
});

describe('computeScaleSize', () => {
  it('halves dimensions at 50%', () => {
    expect(computeScaleSize(800, 600, 50)).toEqual({ w: 400, h: 300 });
  });

  it('clamps to a 1px minimum', () => {
    expect(computeScaleSize(3, 3, 1)).toEqual({ w: 1, h: 1 });
  });

  it('rejects out-of-range percents', () => {
    for (const p of [0, -10, 101, 250, NaN]) {
      expect(() => computeScaleSize(800, 600, p)).toThrow();
    }
  });
});

describe('formatBytes', () => {
  it('formats B, KB, MB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('savingsPct', () => {
  it('computes positive savings and negative growth', () => {
    expect(savingsPct(1000, 600)).toBeCloseTo(40);
    expect(savingsPct(1000, 1200)).toBeCloseTo(-20);
  });

  it('rejects bad inputs', () => {
    expect(() => savingsPct(0, 100)).toThrow();
    expect(() => savingsPct(100, -1)).toThrow();
  });
});

describe('filenames + mimes', () => {
  it('rewrites extensions per output mime', () => {
    expect(buildOutputFilename('photo.png', 'image/jpeg')).toBe('photo.jpg');
    expect(buildOutputFilename('shot.HEIC.png', 'image/webp')).toBe('shot.HEIC.webp');
    expect(buildOutputFilename('noext', 'image/png')).toBe('noext.png');
  });

  it('resolves keep-original mime', () => {
    expect(mimeForFormat('image/png', 'keep')).toBe('image/png');
    expect(mimeForFormat('image/png', 'webp')).toBe('image/webp');
    expect(() => mimeForFormat('image/gif', 'keep')).toThrow();
  });
});

describe('validateImageFile', () => {
  it('accepts png/jpeg/webp under the cap', () => {
    for (const t of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(() => validateImageFile({ type: t, size: 1024, name: 'a.png' })).not.toThrow();
    }
  });

  it('rejects other types and oversize files', () => {
    expect(() => validateImageFile({ type: 'image/gif', size: 100, name: 'a.gif' })).toThrow();
    expect(() => validateImageFile({ type: '', size: 100, name: 'x' })).toThrow();
    expect(() =>
      validateImageFile({ type: 'image/png', size: 26 * 1024 * 1024, name: 'big.png' }),
    ).toThrow();
  });
});

describe('pickAutoQuality', () => {
  it('picks the knee where higher quality costs >10% more bytes', () => {
    const samples = [
      { q: 0.92, bytes: 500_000 },
      { q: 0.85, bytes: 440_000 },
      { q: 0.7, bytes: 300_000 },
      { q: 0.5, bytes: 280_000 },
    ];
    // 300k -> 440k is +46%: knee is q0.7
    expect(pickAutoQuality(samples)).toBe(0.7);
  });

  it('returns best quality on a flat curve', () => {
    const samples = [
      { q: 0.92, bytes: 300_000 },
      { q: 0.8, bytes: 295_000 },
      { q: 0.6, bytes: 290_000 },
    ];
    expect(pickAutoQuality(samples)).toBe(0.92);
  });

  it('handles a single sample', () => {
    expect(pickAutoQuality([{ q: 0.8, bytes: 10 }])).toBe(0.8);
    expect(() => pickAutoQuality([])).toThrow();
  });
});

describe('target + settings constants', () => {
  it('has sane quality bounds and ladder', () => {
    expect(TARGET_MIN_Q).toBeGreaterThan(0);
    expect(TARGET_MAX_Q).toBeLessThanOrEqual(1);
    expect(TARGET_MIN_Q).toBeLessThan(TARGET_MAX_Q);
    expect(AUTO_QUALITY_STEPS.length).toBeGreaterThan(2);
    expect([...AUTO_QUALITY_STEPS].sort((a, b) => b - a)).toEqual(AUTO_QUALITY_STEPS);
  });

  it('describes target mode as overriding quality', () => {
    expect(
      describeSettings({ mode: 'max', format: 'webp', auto: true, manualQ: 0.8, targetOn: true, targetKb: 200 }),
    ).toMatch(/target.*200 KB.*overrides/i);
    expect(
      describeSettings({ mode: 'exact', format: 'jpeg', auto: false, manualQ: 0.75, targetOn: false, targetKb: 200 }),
    ).toMatch(/exact.*q0\.75/i);
  });
});

describe('batch quality helpers', () => {
  it('resolves a single active quality path (target wins)', () => {
    expect(resolveBatchQualityMode({ auto: true, manualQ: 0.8, targetOn: false, targetKb: 200 })).toBe('auto');
    expect(resolveBatchQualityMode({ auto: false, manualQ: 0.7, targetOn: false, targetKb: 200 })).toBe('manual');
    expect(resolveBatchQualityMode({ auto: false, manualQ: 0.7, targetOn: true, targetKb: 150 })).toBe('target');
    expect(resolveBatchQualityMode({ auto: true, manualQ: 0.8, targetOn: true, targetKb: 150 })).toBe('target');
  });

  it('labels the active batch quality for display', () => {
    expect(batchQualityLabel({ auto: true, manualQ: 0.8, targetOn: false, targetKb: 200 })).toBe('auto');
    expect(batchQualityLabel({ auto: false, manualQ: 0.75, targetOn: false, targetKb: 200 })).toBe('q0.75');
    expect(batchQualityLabel({ auto: false, manualQ: 0.75, targetOn: true, targetKb: 120 })).toMatch(/≤ 120 KB/);
  });

  it('clamps quality into encoder range', () => {
    expect(clampQuality(0.5)).toBe(0.5);
    expect(clampQuality(99)).toBe(1);
    expect(clampQuality(-3)).toBe(TARGET_MIN_Q);
    expect(() => clampQuality(NaN)).toThrow();
  });

  it('picks batch targets: skips working, broken, and PNG files', () => {
    const ids = batchQualityTargets([
      { id: 'a', status: 'done', origUrl: 'u1', outMime: 'image/jpeg' },
      { id: 'b', status: 'working', origUrl: 'u2', outMime: 'image/jpeg' },
      { id: 'c', status: 'error', origUrl: '', outMime: 'image/jpeg' },
      { id: 'd', status: 'done', origUrl: 'u4', outMime: 'image/png' },
      { id: 'e', status: 'done', origUrl: 'u5', outMime: 'image/webp' },
    ]);
    expect(ids).toEqual(['a', 'e']);
  });

  it('keeps the original when a same-size PNG re-encode grows', () => {
    expect(shouldKeepOriginal(1000, 1200, false)).toBe(true);
    expect(shouldKeepOriginal(1000, 1000, false)).toBe(true);
    expect(shouldKeepOriginal(1000, 900, false)).toBe(false);
    expect(shouldKeepOriginal(1000, 5000, true)).toBe(false);
  });
});
