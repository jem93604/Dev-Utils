// imgcompress worker: full encode pipeline off the main thread.
// Receives a File + settings snapshot, returns encoded blobs + metrics.
// lib.ts is DOM-free so it imports cleanly here. Uses OffscreenCanvas +
// createImageBitmap (both available in workers); no document access.

import {
  AUTO_QUALITY_STEPS,
  PSNR_COMPARE_MAX,
  PSNR_MIN_DB,
  TARGET_MAX_Q,
  TARGET_MIN_Q,
  TARGET_STEPS,
  applyRenamePattern,
  buildOutputFilename,
  computeExactSize,
  computeFitSize,
  computeScaleSize,
  computePsnr,
  mimeForFormat,
  pickAutoQuality,
  type OutputFormat,
  type ResizeMode,
} from './lib';

export interface WorkerSettings {
  mode: ResizeMode;
  maxW: number;
  maxH: number;
  exactW: number;
  exactH: number;
  scalePct: number;
  format: OutputFormat;
  auto: boolean;
  manualQ: number;
  targetOn: boolean;
  targetKb: number;
  psnrGuard: boolean;
  psnrDb: number;
  renamePattern: string;
}

export interface WorkerRequest {
  kind: 'encode';
  jobId: string;
  file: File;
  fileName: string;
  fileType: string;
  fileSize: number;
  batchIndex: number;
  qualityOverride?: number;
  customMode?: ResizeMode;
  customW?: number;
  customH?: number;
  customPct?: number;
  customFormat?: OutputFormat;
  s: WorkerSettings;
}

export interface WorkerSuccess {
  kind: 'done';
  jobId: string;
  origW: number;
  origH: number;
  outW: number;
  outH: number;
  outName: string;
  outMime: string;
  blob: Blob;
  effQ?: number;
  qualityLabel: string;
  note?: string;
  keptOriginal: boolean;
}

export interface WorkerFailure {
  kind: 'error';
  jobId: string;
  error: string;
}

async function psnrOf(
  src: ImageBitmap,
  blob: Blob,
  tw: number,
  th: number,
  outMime: string,
): Promise<number> {
  const scale = Math.min(1, PSNR_COMPARE_MAX / Math.max(tw, th, 1));
  const cw = Math.max(1, Math.round(tw * scale));
  const ch = Math.max(1, Math.round(th * scale));
  const ref = new OffscreenCanvas(cw, ch);
  const rctx = ref.getContext('2d');
  if (!rctx) throw new Error('OffscreenCanvas 2D unavailable');
  if (outMime === 'image/jpeg') {
    rctx.fillStyle = '#ffffff';
    rctx.fillRect(0, 0, cw, ch);
  }
  rctx.imageSmoothingQuality = 'high';
  rctx.drawImage(src, 0, 0, cw, ch);
  const refData = rctx.getImageData(0, 0, cw, ch).data;
  const outBmp = await createImageBitmap(blob);
  try {
    const out = new OffscreenCanvas(cw, ch);
    const octx = out.getContext('2d');
    if (!octx) throw new Error('OffscreenCanvas 2D unavailable');
    octx.drawImage(outBmp, 0, 0, cw, ch);
    return computePsnr(refData, octx.getImageData(0, 0, cw, ch).data);
  } finally {
    outBmp.close();
  }
}

async function handle(req: WorkerRequest): Promise<WorkerSuccess> {
  const { s } = req;
  const item = {
    customMode: req.customMode,
    customW: req.customW,
    customH: req.customH,
    customPct: req.customPct,
    customFormat: req.customFormat,
  };
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(req.file);
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const mode = item.customMode ?? s.mode;
    let tw: number;
    let th: number;
    if (mode === 'max') ({ w: tw, h: th } = computeFitSize(srcW, srcH, s.maxW, s.maxH));
    else if (mode === 'exact') {
      ({ w: tw, h: th } = computeExactSize(item.customW ?? s.exactW, item.customH ?? s.exactH));
    } else ({ w: tw, h: th } = computeScaleSize(srcW, srcH, item.customPct ?? s.scalePct));

    const outMime = mimeForFormat(req.fileType, item.customFormat ?? s.format);
    const canvas = new OffscreenCanvas(tw, th);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2D unavailable');
    if (outMime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tw, th);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, tw, th);
    const encode = (q?: number) => canvas.convertToBlob({ type: outMime, quality: q });

    const outName = s.renamePattern.trim()
      ? applyRenamePattern(s.renamePattern, req.batchIndex, req.fileName, outMime, tw, th)
      : buildOutputFilename(req.fileName, outMime);
    const base = { origW: srcW, origH: srcH, outW: tw, outH: th, outName, outMime };
    const sameDims = tw === srcW && th === srcH;

    if (outMime === 'image/png') {
      const blob = await encode();
      // Canvas PNG drops the source optimizer work and often grows. Keep the
      // original file when dims are unchanged and we didn't shrink.
      if (!sameDims || blob.size < req.fileSize) {
        return {
          ...base, kind: 'done' as const, jobId: req.jobId, blob,
          qualityLabel: 'lossless (PNG)', keptOriginal: false,
          note: s.targetOn ? 'Target-KB needs JPEG/WebP — PNG is lossless, resized only.' : undefined,
        };
      }
      return {
        ...base, kind: 'done' as const, jobId: req.jobId, blob: req.file,
        qualityLabel: 'kept original (re-encode was larger)', keptOriginal: true,
        note: 'PNG re-encode came out larger — original kept. Convert to WebP/JPEG to actually shrink it.',
      };
    }

    if (s.targetOn) {
      const targetBytes = Math.max(1, Math.round(s.targetKb * 1024));
      let low = TARGET_MIN_Q;
      let high = TARGET_MAX_Q;
      let best: Blob | null = null;
      let bestQ = TARGET_MIN_Q;
      for (let i = 0; i < TARGET_STEPS; i++) {
        const mid = (low + high) / 2;
        const blob = await encode(mid);
        if (blob.size <= targetBytes) {
          best = blob;
          bestQ = mid;
          low = mid;
        } else {
          high = mid;
        }
      }
      if (!best) {
        const blob = await encode(TARGET_MIN_Q);
        return {
          ...base, kind: 'done' as const, jobId: req.jobId, blob, effQ: TARGET_MIN_Q,
          qualityLabel: `q${TARGET_MIN_Q.toFixed(2)} (missed ≤${s.targetKb} KB)`, keptOriginal: false,
          note: `Even lowest quality is ${blob.size} B — target missed. Try smaller dimensions or WebP.`,
        };
      }
      return {
        ...base, kind: 'done' as const, jobId: req.jobId, blob: best, effQ: bestQ,
        qualityLabel: `q${bestQ.toFixed(2)} (≤${s.targetKb} KB)`, keptOriginal: false,
      };
    }

    if (req.qualityOverride != null) {
      const blob = await encode(req.qualityOverride);
      return {
        ...base, kind: 'done' as const, jobId: req.jobId, blob, effQ: req.qualityOverride,
        qualityLabel: `custom q${req.qualityOverride.toFixed(2)}`, keptOriginal: false,
      };
    }

    if (s.auto) {
      const blobs = new Map<number, Blob>();
      const samples = [];
      for (const q of AUTO_QUALITY_STEPS) {
        const blob = await encode(q);
        blobs.set(q, blob);
        samples.push({ q, bytes: blob.size });
      }
      let picked = pickAutoQuality(samples);
      let psnrDb: number | null = null;
      if (s.psnrGuard) {
        const threshold = Number.isFinite(s.psnrDb) ? s.psnrDb : PSNR_MIN_DB;
        const ladder = [...AUTO_QUALITY_STEPS].sort((a, b) => a - b);
        const start = ladder.findIndex((q) => q >= picked);
        for (let i = Math.max(0, start); i < ladder.length; i++) {
          const q = ladder[i];
          psnrDb = await psnrOf(bitmap, blobs.get(q)!, tw, th, outMime);
          picked = q;
          if (psnrDb >= threshold) break;
        }
      }
      const blob = blobs.get(picked) ?? [...blobs.values()][0];
      return {
        ...base, kind: 'done' as const, jobId: req.jobId, blob, effQ: picked,
        qualityLabel:
          psnrDb == null
            ? `auto q${picked.toFixed(2)}`
            : `auto q${picked.toFixed(2)} · ${psnrDb === Infinity ? '∞' : psnrDb.toFixed(1)}dB`,
        keptOriginal: false,
      };
    }

    const blob = await encode(s.manualQ);
    return {
      ...base, kind: 'done' as const, jobId: req.jobId, blob, effQ: s.manualQ,
      qualityLabel: `q${s.manualQ.toFixed(2)}`, keptOriginal: false,
    };
  } finally {
    bitmap?.close();
  }
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  if (req.kind !== 'encode') return;
  try {
    const res = await handle(req);
    self.postMessage(res);
  } catch (err) {
    const fail: WorkerFailure = {
      kind: 'error',
      jobId: req.jobId,
      error: err instanceof Error ? err.message : 'Worker encode failed',
    };
    self.postMessage(fail);
  }
};
