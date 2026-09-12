import { useCallback, useEffect, useRef, useState } from 'react';
import { Field } from '../../components/ui';
import { ErrMsg, UtilShell } from '../ui';
import {
  AUTO_QUALITY_STEPS,
  MAX_FILES,
  TARGET_MAX_Q,
  TARGET_MIN_Q,
  TARGET_STEPS,
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

export function ImgCompressPanel() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [items, setItems] = useState<Item[]>([]);
  const [globalErr, setGlobalErr] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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

  const processOne = useCallback(async (item: Item, s: Settings): Promise<Partial<Item>> => {
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
      const base = { origW: srcW, origH: srcH, outW: tw, outH: th, outName };

      if (outMime === 'image/png') {
        const blob = await encode(canvas, outMime);
        return {
          ...base,
          status: 'done' as const,
          outBytes: blob.size,
          outUrl: URL.createObjectURL(blob),
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
            qualityLabel: `q${TARGET_MIN_Q.toFixed(2)} (missed ≤${s.targetKb} KB)`,
            note: `Even lowest quality is ${formatBytes(blob.size)} — target missed. Try smaller dimensions or WebP.`,
          };
        }
        return {
          ...base,
          status: 'done' as const,
          outBytes: best.size,
          outUrl: URL.createObjectURL(best),
          qualityLabel: `q${bestQ.toFixed(2)} (≤${s.targetKb} KB)`,
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
          qualityLabel: `auto q${picked.toFixed(2)}`,
        };
      }

      const blob = await encode(canvas, outMime, s.manualQ);
      return {
        ...base,
        status: 'done' as const,
        outBytes: blob.size,
        outUrl: URL.createObjectURL(blob),
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
        const patch = await processOne(it, s);
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
    const reset = ok.map((i) => ({ ...i, status: 'working' as const, error: undefined, outUrl: undefined, note: undefined }));
    setItems((prev) => prev.map((p) => reset.find((r) => r.id === p.id) ?? p));
    void runItems(reset, settings);
  };

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
        Re-encoding strips EXIF/metadata.
      </p>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--amber)' : 'var(--border)'}`,
          borderRadius: 9,
          padding: '22px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'var(--bg)' : undefined,
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: '1.4rem' }}>📥</div>
        <div style={{ fontWeight: 700, fontSize: '.85rem' }}>Drop images here or click to browse</div>
        <div style={{ fontSize: '.73rem', color: 'var(--text2)' }}>PNG · JPEG · WebP — up to {MAX_FILES} files</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* Settings */}
      <div className="fmt-grid">
        <div className="fmt-col">
          <Field label="Resize mode">
            <div className="fmt-btns" style={{ marginBottom: 8 }}>
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
          </Field>
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
              <div style={{ fontSize: '.72rem', color: 'var(--text2)' }}>Stretches to exact pixels — distortion + upscale allowed.</div>
            </>
          )}
          {s.mode === 'scale' && (
            <>
              <div className="fmt-btns" style={{ marginBottom: 8 }}>
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
              <div style={{ fontSize: '.72rem', color: 'var(--text2)' }}>Downscale only (1–100%).</div>
            </>
          )}
        </div>

        <div className="fmt-col">
          <Field label="Output format">
            <select className="fmt-btn" value={s.format} onChange={(e) => set('format', e.target.value as OutputFormat)}>
              <option value="keep">Keep original</option>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG (lossless)</option>
              <option value="webp">WebP</option>
            </select>
          </Field>
          <Field label="Quality">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8rem', opacity: qualityDisabled ? 0.45 : 1 }}>
              <input type="checkbox" checked={s.auto} disabled={qualityDisabled}
                onChange={(e) => set('auto', e.target.checked)} /> Auto-quality (max compression, minimal visual change)
            </label>
            {!s.auto && !qualityDisabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <input type="range" min={0.05} max={1} step={0.01} value={s.manualQ}
                  onChange={(e) => set('manualQ', Number(e.target.value))} style={{ flex: 1 }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.78rem' }}>q{s.manualQ.toFixed(2)}</span>
              </div>
            )}
            {qualityDisabled && <div style={{ fontSize: '.72rem', color: 'var(--text2)' }}>Overridden by Target-KB mode.</div>}
            {s.format === 'png' && <div style={{ fontSize: '.72rem', color: 'var(--text2)' }}>PNG is lossless — quality slider does not apply (resize only).</div>}
          </Field>
          <Field label="Target size">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8rem' }}>
              <input type="checkbox" checked={s.targetOn} onChange={(e) => set('targetOn', e.target.checked)} />
              Target max size
              <input className="input-field" type="number" min={1} value={s.targetKb} disabled={!s.targetOn}
                onChange={(e) => set('targetKb', Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                style={{ width: 90 }} /> KB
            </label>
            {s.targetOn && <div style={{ fontSize: '.72rem', color: 'var(--text2)' }}>Binary-searches quality per file. Overrides Auto/manual. PNG files fall back to resize-only.</div>}
          </Field>
        </div>
      </div>

      <div className="fmt-btns" style={{ margin: '10px 0' }}>
        <button className="fmt-btn" onClick={recompress} disabled={busy || items.length === 0}>
          {busy ? 'Working…' : '↻ Recompress with current settings'}
        </button>
        <button className="fmt-btn" onClick={downloadAll} disabled={items.every((i) => i.status !== 'done')}>
          ⬇ Download all
        </button>
        <button className="fmt-btn" onClick={clearAll} disabled={items.length === 0}>✕ Clear</button>
        <span style={{ fontSize: '.73rem', color: 'var(--text2)', alignSelf: 'center' }}>{summary}</span>
      </div>
      <ErrMsg msg={globalErr} />

      {/* Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 10, marginTop: 8 }}>
        {items.map((it) => {
          const done = it.status === 'done' && it.outUrl;
          const pct = done ? savingsPct(it.file.size, it.outBytes!) : null;
          return (
            <div key={it.id} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: 10, background: 'var(--bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: '.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.file.name}
                </div>
                <button className="fmt-btn" onClick={() => removeItem(it.id)} title="Remove">✕</button>
              </div>
              {it.status === 'error' ? (
                <ErrMsg msg={it.error} />
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {it.origUrl && (
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '.68rem', color: 'var(--text2)', marginBottom: 4 }}>Before</div>
                        <img src={it.origUrl} alt="original"
                          style={{ width: '100%', height: 110, objectFit: 'contain', background: 'var(--bg2)', borderRadius: 6 }} />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '.68rem', color: 'var(--text2)', marginBottom: 4 }}>After</div>
                      {done ? (
                        <img src={it.outUrl} alt="compressed"
                          style={{ width: '100%', height: 110, objectFit: 'contain', background: 'var(--bg2)', borderRadius: 6 }} />
                      ) : (
                        <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 6 }}>
                          Working…
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--text2)', marginTop: 6, lineHeight: 1.6 }}>
                    {it.origW != null && <div>Dimensions: {it.origW}×{it.origH}{done && ` → ${it.outW}×${it.outH}`}</div>}
                    <div>Size: {formatBytes(it.file.size)}{done && ` → ${formatBytes(it.outBytes!)}`}</div>
                    {pct != null && (
                      <div style={{ color: pct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                        {pct >= 0 ? '−' : '+'}{Math.abs(pct).toFixed(1)}%{it.qualityLabel && ` · ${it.qualityLabel}`}
                      </div>
                    )}
                  </div>
                  {it.note && <div style={{ fontSize: '.7rem', color: 'var(--amber)', marginTop: 4 }}>{it.note}</div>}
                  {done && (
                    <div className="fmt-btns" style={{ marginTop: 6 }}>
                      <a className="fmt-btn" href={it.outUrl} download={it.outName} style={{ textDecoration: 'none' }}>
                        ⬇ Download
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {items.length === 0 && (
        <div style={{ fontSize: '.75rem', color: 'var(--text3)', textAlign: 'center', marginTop: 10 }}>
          No images yet — drop some above to start.
        </div>
      )}
    </UtilShell>
  );
}

export default ImgCompressPanel;
