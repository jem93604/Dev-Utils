import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Empty, Field, Modal, toast } from '../../components/ui';
import { ErrMsg, UtilShell } from '../ui';
import {
  AUTO_QUALITY_STEPS,
  MAX_FILES,
  TARGET_MAX_Q,
  TARGET_MIN_Q,
  TARGET_STEPS,
  batchQualityLabel,
  batchQualityTargets,
  buildOutputFilename,
  computeExactSize,
  computeFitSize,
  computeScaleSize,
  describeSettings,
  formatBytes,
  mimeForFormat,
  pickAutoQuality,
  savingsPct,
  validateImageFile,
  type OutputFormat,
  type ResizeMode,
} from './lib';

interface Item {
  id: string;
  file: File;
  origUrl: string;
  origW: number | null;
  origH: number | null;
  status: 'working' | 'done' | 'error';
  error?: string;
  outUrl?: string;
  outW?: number;
  outH?: number;
  outBytes?: number;
  qualityLabel?: string;
  note?: string;
  outName?: string;
  outMime?: string;
  outBlob?: Blob;
  /** Effective encode quality (auto-picked, manual, target-found, or custom). */
  effQ?: number;
  /** Per-card tuner override (null = follow batch settings). */
  customQ?: number;
  tuning?: boolean;
}

interface Settings {
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
}

const DEFAULTS: Settings = {
  mode: 'max',
  maxW: 1920,
  maxH: 1920,
  exactW: 800,
  exactH: 600,
  scalePct: 50,
  format: 'keep',
  auto: true,
  manualQ: 0.8,
  targetOn: false,
  targetKb: 200,
};

function encode(canvas: HTMLCanvasElement, mime: string, q?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Encode failed'))),
      mime,
      q,
    );
  });
}

let idSeq = 0;
const nid = () => `${Date.now()}-${idSeq++}`;

const cardStyle: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: 12,
  background: 'var(--bg)',
};

const hintStyle: CSSProperties = { fontSize: '.72rem', color: 'var(--text2)', marginTop: 4 };

const thumbLabelStyle: CSSProperties = {
  fontSize: '.66rem',
  fontWeight: 700,
  color: 'var(--text3)',
  textTransform: 'uppercase',
  letterSpacing: '.08em',
  marginBottom: 4,
};

const zoomBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: 6,
  right: 6,
  fontSize: '.7rem',
  background: 'rgba(0,0,0,.55)',
  color: '#fff',
  borderRadius: 6,
  padding: '1px 6px',
  pointerEvents: 'none',
};

const checkerStyle: CSSProperties = {
  background:
    'repeating-conic-gradient(var(--bg3) 0% 25%, var(--bg2) 0% 50%) 0 0 / 22px 22px',
  border: '1px solid var(--border2)',
  borderRadius: 8,
};

export function ImgCompressPanel() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [items, setItems] = useState<Item[]>([]);
  const [globalErr, setGlobalErr] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<{ id: string; side: 'before' | 'after' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<Item[]>([]);
  const settingsRef = useRef(settings);
  // Mirror latest state for async callbacks without reading refs during render.
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(
    () => () => {
      for (const it of itemsRef.current) {
        URL.revokeObjectURL(it.origUrl);
        if (it.outUrl) URL.revokeObjectURL(it.outUrl);
      }
    },
    [],
  );

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const processOne = useCallback(async (item: Item, s: Settings, qualityOverride?: number): Promise<Partial<Item>> => {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(item.file);
      const srcW = bitmap.width;
      const srcH = bitmap.height;
      let tw: number;
      let th: number;
      if (s.mode === 'max') ({ w: tw, h: th } = computeFitSize(srcW, srcH, s.maxW, s.maxH));
      else if (s.mode === 'exact') ({ w: tw, h: th } = computeExactSize(s.exactW, s.exactH));
      else ({ w: tw, h: th } = computeScaleSize(srcW, srcH, s.scalePct));

      const outMime = mimeForFormat(item.file.type, s.format);
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D unavailable');
      if (outMime === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tw, th);
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, tw, th);

      const outName = buildOutputFilename(item.file.name, outMime);
      const base = { origW: srcW, origH: srcH, outW: tw, outH: th, outName, outMime };

      if (outMime === 'image/png') {
        const blob = await encode(canvas, outMime);
        return {
          ...base,
          status: 'done' as const,
          outBytes: blob.size,
          outUrl: URL.createObjectURL(blob),
          outBlob: blob,
          qualityLabel: 'lossless (PNG)',
          note: s.targetOn ? 'Target-KB needs JPEG/WebP — PNG is lossless, resized only.' : undefined,
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
          const blob = await encode(canvas, outMime, mid);
          if (blob.size <= targetBytes) {
            best = blob;
            bestQ = mid;
            low = mid;
          } else {
            high = mid;
          }
        }
        if (!best) {
          const blob = await encode(canvas, outMime, TARGET_MIN_Q);
          return {
            ...base,
            status: 'done' as const,
            outBytes: blob.size,
            outUrl: URL.createObjectURL(blob),
            outBlob: blob,
            effQ: TARGET_MIN_Q,
            qualityLabel: `q${TARGET_MIN_Q.toFixed(2)} (missed ≤${s.targetKb} KB)`,
            note: `Even lowest quality is ${formatBytes(blob.size)} — target missed. Try smaller dimensions or WebP.`,
          };
        }
        return {
          ...base,
          status: 'done' as const,
          outBytes: best.size,
          outUrl: URL.createObjectURL(best),
          outBlob: best,
          effQ: bestQ,
          qualityLabel: `q${bestQ.toFixed(2)} (≤${s.targetKb} KB)`,
        };
      }

      // Per-card quality tuner overrides batch quality (single encode at chosen q).
      if (qualityOverride != null) {
        const blob = await encode(canvas, outMime, qualityOverride);
        return {
          ...base,
          status: 'done' as const,
          outBytes: blob.size,
          outUrl: URL.createObjectURL(blob),
          outBlob: blob,
          effQ: qualityOverride,
          qualityLabel: `custom q${qualityOverride.toFixed(2)}`,
        };
      }

      if (s.auto) {
        const blobs = new Map<number, Blob>();
        const samples = [];
        for (const q of AUTO_QUALITY_STEPS) {
          const blob = await encode(canvas, outMime, q);
          blobs.set(q, blob);
          samples.push({ q, bytes: blob.size });
        }
        const picked = pickAutoQuality(samples);
        const blob = blobs.get(picked) ?? [...blobs.values()][0];
        return {
          ...base,
          status: 'done' as const,
          outBytes: blob.size,
          outUrl: URL.createObjectURL(blob),
          outBlob: blob,
          effQ: picked,
          qualityLabel: `auto q${picked.toFixed(2)}`,
        };
      }

      const blob = await encode(canvas, outMime, s.manualQ);
      return {
        ...base,
        status: 'done' as const,
        outBytes: blob.size,
        outUrl: URL.createObjectURL(blob),
        outBlob: blob,
        effQ: s.manualQ,
        qualityLabel: `q${s.manualQ.toFixed(2)}`,
      };
    } catch (e) {
      return { status: 'error' as const, error: e instanceof Error ? e.message : 'Processing failed' };
    } finally {
      bitmap?.close();
    }
  }, []);

  const runItems = useCallback(
    async (list: Item[], s: Settings) => {
      setBusy(true);
      setGlobalErr(undefined);
      for (const it of list) {
        const patch = await processOne(it, s, it.customQ ?? undefined);
        if (patch.outUrl) {
          setItems((prev) => {
            const old = prev.find((p) => p.id === it.id);
            if (old?.outUrl && old.outUrl !== patch.outUrl) URL.revokeObjectURL(old.outUrl);
            return prev.map((p) => (p.id === it.id ? { ...p, ...patch } : p));
          });
        } else {
          setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, ...patch } : p)));
        }
      }
      setBusy(false);
    },
    [processOne],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = [...files];
      if (arr.length === 0) return;
      if (itemsRef.current.length + arr.length > MAX_FILES) {
        setGlobalErr(`Max ${MAX_FILES} files per batch — drop fewer at once.`);
        return;
      }
      const fresh: Item[] = [];
      for (const f of arr) {
        try {
          validateImageFile({ type: f.type, size: f.size, name: f.name });
        } catch (e) {
          setItems((prev) => [
            ...prev,
            {
              id: nid(),
              file: f,
              origUrl: '',
              origW: null,
              origH: null,
              status: 'error',
              error: e instanceof Error ? e.message : 'Rejected',
            },
          ]);
          continue;
        }
        fresh.push({
          id: nid(),
          file: f,
          origUrl: URL.createObjectURL(f),
          origW: null,
          origH: null,
          status: 'working',
        });
      }
      if (fresh.length === 0) return;
      setItems((prev) => [...prev, ...fresh]);
      await runItems(fresh, settingsRef.current);
    },
    [runItems],
  );

  const recompress = () => {
    const ok = items.filter((i) => i.status !== 'error' || i.origUrl);
    for (const it of ok) if (it.outUrl) URL.revokeObjectURL(it.outUrl);
    const reset = ok.map((i) => ({ ...i, status: 'working' as const, error: undefined, outUrl: undefined, outBlob: undefined, note: undefined }));
    setItems((prev) => prev.map((p) => reset.find((r) => r.id === p.id) ?? p));
    void runItems(reset, settings);
  };

  /** Per-card quality tuner: re-encode just this file at a chosen quality. */
  const tuneQuality = async (id: string, q: number) => {
    const target = items.find((i) => i.id === id);
    if (!target || target.status === 'working') return;
    setItems((prev) =>
      prev.map((p) => (p.id === id ? { ...p, tuning: true, customQ: q } : p)),
    );
    try {
      const patch = await processOne(
        { ...target, customQ: q },
        settingsRef.current,
        // PNG ignores quality — leave those on the standard path.
        target.outMime === 'image/png' ? undefined : q,
      );
      if (patch.outUrl && target.outUrl) URL.revokeObjectURL(target.outUrl);
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, tuning: false } : p)));
    } catch (e) {
      setItems((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, tuning: false, error: e instanceof Error ? e.message : 'Tune failed' }
            : p,
        ),
      );
    }
  };

  /** Batch quality slider: re-encode every eligible file at one quality. */
  const applyBatchQuality = async (q: number) => {
    setSettings((prev) => ({ ...prev, auto: false, targetOn: false, manualQ: q }));
    const ids = batchQualityTargets(
      itemsRef.current.map((i) => ({ id: i.id, status: i.status, origUrl: i.origUrl, outMime: i.outMime })),
    );
    if (ids.length === 0) return;
    const s = { ...settingsRef.current, auto: false, targetOn: false, manualQ: q };
    settingsRef.current = s;
    await runItems(
      itemsRef.current
        .filter((i) => ids.includes(i.id))
        .map((i) => ({ ...i, customQ: undefined, status: 'working' as const, tuning: false })),
      s,
    );
  };

  /** Reset a card to batch settings. */
  const resetTune = (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target) return;
    setItems((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, customQ: undefined, status: 'working' as const, tuning: false } : p,
      ),
    );
    if (target.outUrl) URL.revokeObjectURL(target.outUrl);
    void runItems(
      [{ ...target, customQ: undefined, status: 'working' as const }],
      settingsRef.current,
    );
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} ✓`);
    } catch {
      setGlobalErr('Clipboard blocked — allow clipboard access and retry.');
    }
  };

  const blobToDataUri = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('Data-URI read failed'));
      r.readAsDataURL(blob);
    });

  const copyDataUri = async (it: Item) => {
    if (!it.outBlob || !it.outMime) return;
    try {
      const uri = await blobToDataUri(it.outBlob);
      await copyText(uri, 'Data-URI copied');
    } catch (e) {
      setGlobalErr(e instanceof Error ? e.message : 'Copy failed');
    }
  };

  const copyImgTag = async (it: Item) => {
    if (!it.outBlob || !it.outMime) return;
    try {
      const uri = await blobToDataUri(it.outBlob);
      const tag = `<img src="${uri}" width="${it.outW ?? ''}" height="${it.outH ?? ''}" alt="${it.outName ?? 'image'}" />`;
      await copyText(tag, '<img> snippet copied');
    } catch (e) {
      setGlobalErr(e instanceof Error ? e.message : 'Copy failed');
    }
  };

  // Paste screenshots straight in (Ctrl+V anywhere in the panel).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (files.length > 0) {
        e.preventDefault();
        void addFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  const removeItem = (id: string) => {
    const it = items.find((i) => i.id === id);
    if (it) {
      if (it.origUrl) URL.revokeObjectURL(it.origUrl);
      if (it.outUrl) URL.revokeObjectURL(it.outUrl);
    }
    setItems((prev) => prev.filter((p) => p.id !== id));
  };

  const clearAll = () => {
    for (const it of items) {
      if (it.origUrl) URL.revokeObjectURL(it.origUrl);
      if (it.outUrl) URL.revokeObjectURL(it.outUrl);
    }
    setItems([]);
    setGlobalErr(undefined);
  };

  const downloadAll = () => {
    const done = items.filter((i) => i.status === 'done' && i.outUrl);
    if (done.length === 0) return;
    done.forEach((it, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = it.outUrl!;
        a.download = it.outName ?? it.file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, idx * 350);
    });
  };

  const s = settings;
  const qualityDisabled = s.targetOn;
  const [batchQ, setBatchQ] = useState(s.manualQ);
  const [pvTab, setPvTab] = useState<'before' | 'after' | 'compare'>('compare');
  const [sliderPos, setSliderPos] = useState(50);
  const openPreview = (id: string, side: 'before' | 'after') => {
    setPvTab('compare');
    setSliderPos(50);
    setPreview({ id, side });
  };
  const doneItems = items.filter((i) => i.status === 'done' && i.outUrl && i.outBytes != null);
  const doneOrig = doneItems.reduce((a, i) => a + i.file.size, 0);
  const doneOut = doneItems.reduce((a, i) => a + (i.outBytes ?? 0), 0);
  const donePct = doneOrig > 0 ? ((doneOrig - doneOut) / doneOrig) * 100 : 0;
  const previewItem = preview ? items.find((i) => i.id === preview.id) : undefined;
  const summary = describeSettings({
    mode: s.mode,
    format: s.format,
    auto: s.auto,
    manualQ: s.manualQ,
    targetOn: s.targetOn,
    targetKb: s.targetKb,
  });

  return (
    <UtilShell id="util-imgcompress" color="#38bdf8" title="🗜️ Image Compressor">
      <p style={{ fontSize: '.78rem', color: 'var(--text2)', margin: '0 0 12px' }}>
        Batch resize + compress PNG/JPEG/WebP. Everything runs locally — nothing leaves your browser.
        Re-encoding strips EXIF/metadata. Click any thumbnail for a full-size preview.
      </p>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--amber)' : 'var(--border2)'}`,
          borderRadius: 12,
          padding: '26px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'var(--amber-dim)' : 'var(--bg)',
          transition: 'all .15s',
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: '1.7rem', marginBottom: 4 }}>📥</div>
        <div style={{ fontWeight: 700, fontSize: '.88rem' }}>
          {items.length === 0 ? 'Drop images here or click to browse' : 'Drop more images or click to add'}
        </div>
        <div style={{ fontSize: '.73rem', color: 'var(--text2)', marginTop: 2 }}>
          PNG · JPEG · WebP — up to {MAX_FILES} files per batch · <kbd style={{ fontFamily: "'JetBrains Mono',monospace", background: 'var(--bg3)', borderRadius: 4, padding: '0 5px' }}>Ctrl+V</kbd> pastes screenshots
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {doneItems.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            alignItems: 'center',
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'var(--bg)',
            padding: '8px 14px',
            marginBottom: 12,
            fontSize: '.75rem',
            color: 'var(--text2)',
          }}
        >
          <span>
            <strong style={{ color: 'var(--text)' }}>{doneItems.length}</strong>{' '}
            {doneItems.length === 1 ? 'image' : 'images'} done
          </span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>
            {formatBytes(doneOrig)} → {formatBytes(doneOut)}
          </span>
          <span style={{ fontWeight: 800, color: donePct >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {donePct >= 0 ? '−' : '+'}
            {Math.abs(donePct).toFixed(1)}% total
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--text3)' }}>{summary}</span>
        </div>
      )}

      {/* Settings — three cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10 }}>
        <div style={cardStyle}>
          <div style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            1 · Resize
          </div>
          <div className="fmt-btns" style={{ marginTop: 0, marginBottom: 8 }}>
            {(['max', 'exact', 'scale'] as ResizeMode[]).map((m) => (
              <button
                key={m}
                className="fmt-btn"
                onClick={() => set('mode', m)}
                style={s.mode === m ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}
              >
                {m === 'max' ? 'Max fit' : m === 'exact' ? 'Exact W×H' : 'Scale %'}
              </button>
            ))}
          </div>
          {s.mode === 'max' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Field label="Max width (px)">
                <input className="input-field" type="number" min={1} value={s.maxW}
                  onChange={(e) => set('maxW', Math.max(1, Math.floor(Number(e.target.value) || 1)))} style={{ width: '100%' }} />
              </Field>
              <Field label="Max height (px)">
                <input className="input-field" type="number" min={1} value={s.maxH}
                  onChange={(e) => set('maxH', Math.max(1, Math.floor(Number(e.target.value) || 1)))} style={{ width: '100%' }} />
              </Field>
            </div>
          )}
          {s.mode === 'exact' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <Field label="Width (px)">
                  <input className="input-field" type="number" min={1} value={s.exactW}
                    onChange={(e) => set('exactW', Math.max(1, Math.floor(Number(e.target.value) || 1)))} style={{ width: '100%' }} />
                </Field>
                <Field label="Height (px)">
                  <input className="input-field" type="number" min={1} value={s.exactH}
                    onChange={(e) => set('exactH', Math.max(1, Math.floor(Number(e.target.value) || 1)))} style={{ width: '100%' }} />
                </Field>
              </div>
              <div style={hintStyle}>Stretches to exact pixels — distortion + upscale allowed.</div>
            </>
          )}
          {s.mode === 'scale' && (
            <>
              <div className="fmt-btns" style={{ marginTop: 0, marginBottom: 8 }}>
                {[25, 50, 75].map((p) => (
                  <button key={p} className="fmt-btn" onClick={() => set('scalePct', p)}
                    style={s.scalePct === p ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}>
                    {p}%
                  </button>
                ))}
                <input className="input-field" type="number" min={1} max={100} value={s.scalePct}
                  onChange={(e) => set('scalePct', Math.min(100, Math.max(1, Math.floor(Number(e.target.value) || 1))))}
                  style={{ width: 90 }} />
              </div>
              <div style={hintStyle}>Downscale only (1–100%).</div>
            </>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            2 · Format + quality
          </div>
          <Field label="Output format">
            <select
              className="fmt-btn"
              value={s.format}
              onChange={(e) => set('format', e.target.value as OutputFormat)}
              style={{ width: '100%' }}
            >
              <option value="keep">Keep original</option>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG (lossless)</option>
              <option value="webp">WebP</option>
            </select>
          </Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8rem', opacity: qualityDisabled ? 0.45 : 1, marginTop: 4 }}>
            <input type="checkbox" checked={s.auto} disabled={qualityDisabled}
              onChange={(e) => set('auto', e.target.checked)} /> Auto-quality
          </label>
          <div style={hintStyle}>Sweeps qualities, keeps max compression with minimal visual change.</div>
          <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <div style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              Batch quality
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.01}
                value={batchQ}
                disabled={qualityDisabled || busy}
                onChange={(e) => setBatchQ(Number(e.target.value))}
                onPointerUp={(e) => void applyBatchQuality(Number((e.target as HTMLInputElement).value))}
                onKeyUp={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') void applyBatchQuality(batchQ);
                }}
                style={{ flex: 1 }}
                aria-label="Batch quality for all files"
              />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.78rem', minWidth: 44, textAlign: 'right' }}>
                q{batchQ.toFixed(2)}
              </span>
            </div>
            <div style={hintStyle}>
              {qualityDisabled
                ? 'Overridden by Target-KB mode — turn it off to use this.'
                : 'Drag to re-encode the whole batch at one quality. Active path: ' + batchQualityLabel({ auto: s.auto, manualQ: s.manualQ, targetOn: s.targetOn, targetKb: s.targetKb }) + '.'}
            </div>
          </div>
          {s.format === 'png' && <div style={hintStyle}>PNG is lossless — quality does not apply (resize only).</div>}
        </div>

        <div style={cardStyle}>
          <div style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            3 · Size target
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8rem' }}>
            <input type="checkbox" checked={s.targetOn} onChange={(e) => set('targetOn', e.target.checked)} />
            Target max size
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input className="input-field" type="number" min={1} value={s.targetKb} disabled={!s.targetOn}
              onChange={(e) => set('targetKb', Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              style={{ width: 110 }} />
            <span style={{ fontSize: '.78rem', color: 'var(--text2)' }}>KB per file</span>
          </div>
          <div style={hintStyle}>
            {s.targetOn
              ? 'Binary-searches quality per file. Overrides Auto/manual. PNG falls back to resize-only.'
              : 'Off — Auto/manual quality applies. Turn on to force every file under a size cap.'}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '.73rem', color: 'var(--text2)', marginTop: 8 }}>{summary}</div>
      <ErrMsg msg={globalErr} />

      {/* Batch bar: actions + batch quality shortcut */}
      {items.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center',
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'var(--bg)',
            padding: '8px 12px',
            marginTop: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 220px', minWidth: 200 }}>
            <span style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
              Batch q
            </span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.01}
              value={batchQ}
              disabled={qualityDisabled || busy}
              onChange={(e) => setBatchQ(Number(e.target.value))}
              onPointerUp={(e) => void applyBatchQuality(Number((e.target as HTMLInputElement).value))}
              style={{ flex: 1 }}
              aria-label="Batch quality for all files"
            />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.75rem', minWidth: 40 }}>
              q{batchQ.toFixed(2)}
            </span>
          </div>
          <div className="fmt-btns" style={{ marginTop: 0 }}>
            <button className="fmt-btn" onClick={recompress} disabled={busy}>
              {busy ? 'Working…' : '↻ Recompress'}
            </button>
            <button className="fmt-btn" onClick={downloadAll} disabled={items.every((i) => i.status !== 'done')}>
              ⬇ Download all
            </button>
            <button className="fmt-btn" onClick={clearAll}>✕ Clear</button>
          </div>
        </div>
      )}

      {/* Results */}
      {items.length === 0 ? (
        <Empty icon="🖼️" text="No images yet" hint="Drop files above — thumbnails, savings, and downloads appear here" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 10, marginTop: 10 }}>
          {items.map((it) => {
            const done = it.status === 'done' && it.outUrl;
            const pct = done ? savingsPct(it.file.size, it.outBytes!) : null;
            return (
              <div key={it.id} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '.78rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                    title={it.file.name}
                  >
                    {it.file.name}
                  </div>
                  {done && pct != null && (
                    <span
                      style={{
                        fontSize: '.68rem',
                        fontWeight: 800,
                        color: pct >= 0 ? 'var(--green)' : 'var(--red)',
                        background: pct >= 0 ? 'rgba(52,211,153,.12)' : 'rgba(248,113,113,.12)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {pct >= 0 ? '−' : '+'}
                      {Math.abs(pct).toFixed(1)}%
                    </span>
                  )}
                  <button
                    className="fmt-btn"
                    onClick={() => removeItem(it.id)}
                    title="Remove"
                    style={{ padding: '2px 8px' }}
                  >
                    ✕
                  </button>
                </div>
                {it.status === 'error' ? (
                  <ErrMsg msg={it.error} />
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { side: 'before' as const, url: it.origUrl, label: 'Before' },
                        { side: 'after' as const, url: done ? it.outUrl : undefined, label: 'After' },
                      ].map(({ side, url, label }) => (
                        <div key={side} style={{ flex: 1, minWidth: 0 }}>
                          <div style={thumbLabelStyle}>{label}</div>
                          {url ? (
                            <button
                              onClick={() => openPreview(it.id, side)}
                              title={`${label} — click to preview full size`}
                              style={{
                                ...checkerStyle,
                                display: 'block',
                                width: '100%',
                                padding: 0,
                                cursor: 'zoom-in',
                                position: 'relative',
                                overflow: 'hidden',
                              }}
                            >
                              <img
                                src={url}
                                alt={side === 'before' ? 'original' : 'compressed'}
                                style={{ width: '100%', height: 128, objectFit: 'contain', display: 'block' }}
                              />
                              <span style={zoomBadgeStyle}>⤢</span>
                            </button>
                          ) : (
                            <div
                              style={{
                                height: 128,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '.75rem',
                                color: 'var(--text3)',
                                background: 'var(--bg2)',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                              }}
                            >
                              Working…
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 12,
                        flexWrap: 'wrap',
                        fontSize: '.72rem',
                        color: 'var(--text2)',
                        marginTop: 8,
                        fontFamily: "'JetBrains Mono',monospace",
                      }}
                    >
                      <span title="Dimensions">
                        📐 {it.origW != null ? `${it.origW}×${it.origH}` : '…'}
                        {done && ` → ${it.outW}×${it.outH}`}
                      </span>
                      <span title="File size">
                        💾 {formatBytes(it.file.size)}
                        {done && ` → ${formatBytes(it.outBytes!)}`}
                      </span>
                      {it.qualityLabel && <span title="Encode quality">⚙️ {it.qualityLabel}</span>}
                    </div>
                    {it.note && <div style={{ fontSize: '.7rem', color: 'var(--amber)', marginTop: 4 }}>{it.note}</div>}
                    {/* Quality tuner (JPEG/WebP only) */}
                    {done && it.outMime !== 'image/png' && (
                      <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '.68rem', fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                            Tune
                          </span>
                          <input
                            type="range"
                            min={0.05}
                            max={1}
                            step={0.01}
                            value={it.customQ ?? it.effQ ?? 0.8}
                            disabled={it.tuning || it.status === 'working'}
                            onChange={(e) => {
                              const q = Number(e.target.value);
                              setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, customQ: q } : p)));
                            }}
                            onMouseUp={(e) => void tuneQuality(it.id, Number((e.target as HTMLInputElement).value))}
                            onTouchEnd={(e) => void tuneQuality(it.id, Number((e.target as HTMLInputElement).value))}
                            style={{ flex: 1 }}
                          />
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.72rem', minWidth: 40, textAlign: 'right' }}>
                            {it.tuning ? '…' : `q${(it.customQ ?? it.effQ ?? 0.8).toFixed(2)}`}
                          </span>
                          {it.customQ != null && (
                            <button className="fmt-btn" onClick={() => resetTune(it.id)} title="Back to batch settings" style={{ padding: '2px 8px' }}>
                              ↺
                            </button>
                          )}
                        </div>
                        <div style={hintStyle}>
                          {it.tuning
                            ? 'Re-encoding…'
                            : it.customQ != null
                              ? 'Custom quality — release slider to apply, ↺ to reset to batch.'
                              : `Batch quality ${it.qualityLabel ?? ''} — drag to override this file.`}
                        </div>
                      </div>
                    )}
                    {done && (
                      <div className="fmt-btns" style={{ marginTop: 8 }}>
                        <a className="fmt-btn" href={it.outUrl} download={it.outName} style={{ textDecoration: 'none' }}>
                          ⬇ Download
                        </a>
                        <button className="fmt-btn" onClick={() => openPreview(it.id, 'after')}>
                          ⤢ Compare
                        </button>
                        <button className="fmt-btn" onClick={() => void copyDataUri(it)} title="Copy output as data: URI">
                          ⎘ Data-URI
                        </button>
                        <button className="fmt-btn" onClick={() => void copyImgTag(it)} title="Copy <img> embed snippet">
                          ⎘ &lt;img&gt;
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      <Modal
        open={!!previewItem && !!preview}
        onClose={() => setPreview(null)}
        title={previewItem?.file.name ?? 'Preview'}
        sub={
          previewItem && previewItem.outBytes != null
            ? `${previewItem.origW ?? '…'}×${previewItem.origH ?? '…'} · ${formatBytes(previewItem.file.size)} → ${previewItem.outW}×${previewItem.outH} · ${formatBytes(previewItem.outBytes)}${previewItem.qualityLabel ? ` · ${previewItem.qualityLabel}` : ''}`
            : 'Full-size preview'
        }
        wide
        footer={
          previewItem?.status === 'done' && previewItem.outUrl ? (
            <a className="fmt-btn" href={previewItem.outUrl} download={previewItem.outName} style={{ textDecoration: 'none' }}>
              ⬇ Download
            </a>
          ) : undefined
        }
      >
        {previewItem && (
          <>
            {previewItem.status === 'done' && previewItem.outUrl ? (
              <>
                <div className="fmt-btns" style={{ marginTop: 0, marginBottom: 10 }}>
                  {(['before', 'after', 'compare'] as const).map((t) => (
                    <button
                      key={t}
                      className="fmt-btn"
                      onClick={() => setPvTab(t)}
                      style={pvTab === t ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}
                    >
                      {t === 'before' ? 'Before' : t === 'after' ? 'After' : '⇔ Compare slider'}
                    </button>
                  ))}
                </div>
                {pvTab === 'compare' ? (
                  <>
                    <div
                      style={{
                        ...checkerStyle,
                        position: 'relative',
                        maxHeight: '65vh',
                        overflow: 'hidden',
                        userSelect: 'none',
                        touchAction: 'none',
                        cursor: 'ew-resize',
                      }}
                      onPointerDown={(e) => {
                        const el = e.currentTarget;
                        const move = (ev: PointerEvent) => {
                          const r = el.getBoundingClientRect();
                          setSliderPos(Math.min(100, Math.max(0, ((ev.clientX - r.left) / r.width) * 100)));
                        };
                        move(e.nativeEvent);
                        const up = () => {
                          window.removeEventListener('pointermove', move);
                          window.removeEventListener('pointerup', up);
                        };
                        window.addEventListener('pointermove', move);
                        window.addEventListener('pointerup', up);
                      }}
                    >
                      <img src={previewItem.outUrl} alt="after full size" style={{ width: '100%', display: 'block' }} draggable={false} />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          overflow: 'hidden',
                          width: `${sliderPos}%`,
                          borderRight: '2px solid var(--amber)',
                        }}
                      >
                        <div style={{ width: `${sliderPos === 0 ? 100 : 10000 / sliderPos}%`, maxWidth: 'none' }}>
                          <img src={previewItem.origUrl} alt="before full size" style={{ width: '100%', display: 'block' }} draggable={false} />
                        </div>
                      </div>
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: `${sliderPos}%`,
                          width: 0,
                          pointerEvents: 'none',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: 0,
                            transform: 'translate(-50%,-50%)',
                            background: 'var(--amber)',
                            color: '#000',
                            borderRadius: '50%',
                            width: 34,
                            height: 34,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '.9rem',
                            fontWeight: 800,
                            boxShadow: '0 2px 10px rgba(0,0,0,.5)',
                          }}
                        >
                          ⇔
                        </div>
                      </div>
                      <span style={{ ...zoomBadgeStyle, left: 6, right: 'auto' }}>before</span>
                      <span style={zoomBadgeStyle}>after</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={0.5}
                      value={sliderPos}
                      onChange={(e) => setSliderPos(Number(e.target.value))}
                      style={{ width: '100%', marginTop: 8 }}
                      aria-label="Compare position"
                    />
                  </>
                ) : (
                  <div style={{ ...checkerStyle, maxHeight: '65vh', overflow: 'auto' }}>
                    <img
                      src={pvTab === 'before' ? previewItem.origUrl : previewItem.outUrl}
                      alt={`${pvTab} full size`}
                      style={{ width: '100%', display: 'block' }}
                    />
                  </div>
                )}
              </>
            ) : previewItem.origUrl ? (
              <div style={{ ...checkerStyle, maxHeight: '65vh', overflow: 'auto' }}>
                <img src={previewItem.origUrl} alt="original full size" style={{ width: '100%', display: 'block' }} />
              </div>
            ) : (
              <ErrMsg msg={previewItem.error ?? 'Nothing to preview'} />
            )}
          </>
        )}
      </Modal>
    </UtilShell>
  );
}

export default ImgCompressPanel;
