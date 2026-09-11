import { useMemo, useState } from "react";
import { detectPlatform, isPlaylistUrl, isValidMediaUrl } from "./lib";
import { CopyBtn, UtilShell } from "../ui";
import { Empty, QTag, toast } from "../../components/ui";

interface MediaFormat {
  id: string;
  height?: number | null;
  note?: string;
  quality?: string;
  ext: string;
  url: string | null;
}

interface MediaVariant {
  id: string;
  label: string;
  kind: "video" | "audio";
  quality: string;
  audio_only: boolean;
  download_endpoint: string;
  available?: boolean | null;
  ext: string;
}

interface Resolved {
  platform: string;
  title: string;
  thumbnail: string;
  source: string;
  download_url: string | null;
  download_endpoint?: string | null;
  variants?: MediaVariant[];
  duration?: number | null;
  formats?: MediaFormat[];
}

const PLATFORMS: Array<{ id: string; label: string; icon: string }> = [
  { id: "youtube", label: "YouTube", icon: "▶" },
  { id: "tiktok", label: "TikTok", icon: "♪" },
  { id: "twitter", label: "X", icon: "𝕏" },
  { id: "instagram", label: "Instagram", icon: "◉" },
  { id: "reddit", label: "Reddit", icon: "◈" },
  { id: "vimeo", label: "Vimeo", icon: "▷" },
];

const SAMPLES = [
  { label: "YouTube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { label: "TikTok", url: "https://www.tiktok.com/@user/video/1234567890" },
  { label: "Vimeo", url: "https://vimeo.com/123456789" },
];

function platformLabel(id: string): string {
  return PLATFORMS.find((p) => p.id === id)?.label ?? (id === "generic" ? "Generic link" : id);
}

export function LinkSaverPanel() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [dlId, setDlId] = useState<string | null>(null);
  const [dlDone, setDlDone] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | undefined>();

  const trimmed = url.trim();
  const platform = useMemo(() => (trimmed ? detectPlatform(trimmed) : ""), [trimmed]);
  const valid = trimmed ? isValidMediaUrl(trimmed) : false;
  const playlist = trimmed ? isPlaylistUrl(trimmed) : false;

  const resolve = async () => {
    setError(undefined);
    setDlError(undefined);
    setDlId(null);
    setDlDone(null);
    setData(null);
    if (!isValidMediaUrl(url)) {
      setError("Paste a valid http(s) video URL first.");
      return;
    }
    if (isPlaylistUrl(url)) {
      setError("Playlists aren't supported yet — paste a single video URL.");
      return;
    }
    setLoading(true);
    try {
      // Single metadata fetch — the response carries every quality/format
      // link (see variants), so no re-fetch per quality.
      const r = await fetch("/api/v1/media/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), quality: "720", audio_only: false }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { detail?: string }).detail ?? `Resolve failed (${r.status})`);
      }
      const resolved = (await r.json()) as Resolved;
      setData(resolved);
      if (!resolved.download_url && !resolved.download_endpoint && !(resolved.variants ?? []).length)
        toast("Resolved — no direct file (see formats)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setLoading(false);
    }
  };

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setUrl(t.trim());
        toast("Pasted ✓");
      } else toast("Clipboard is empty");
    } catch {
      toast("Clipboard blocked — paste manually");
    }
  };

  const clear = () => {
    setUrl("");
    setData(null);
    setError(undefined);
    setDlError(undefined);
    setDlId(null);
    setDlDone(null);
  };

  const variants = data?.variants ?? [];
  const videoVariants = variants.filter((v) => v.kind === "video");
  const audioVariant = variants.find((v) => v.kind === "audio") ?? null;
  const directHref = data?.download_url ?? null;

  const downloadVariant = async (v: MediaVariant) => {
    if (dlId) return;
    setDlError(undefined);
    setDlId(v.id);
    try {
      const r = await fetch(v.download_endpoint);
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        const msg =
          (d as { detail?: string } | null)?.detail ?? `Download failed (${r.status})`;
        throw new Error(msg);
      }
      const blob = await r.blob();
      const cd = r.headers.get("content-disposition") ?? "";
      const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
      const fallback = data?.title
        ? `${data.title.slice(0, 80)}.${v.ext}`
        : v.kind === "audio"
          ? "audio.mp3"
          : "video.mp4";
      const name = m ? decodeURIComponent(m[1]) : fallback;
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 5000);
      setDlDone(v.id);
      toast("Downloaded ✓");
    } catch (e) {
      setDlError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDlId(null);
    }
  };

  return (
    <UtilShell id="util-linksaver" color="#38bdf8" title="🔗 Link Saver">
      <style>{`
        .ls-sub{font-size:.76rem;color:var(--text2);line-height:1.55;margin-bottom:12px}
        .ls-sub b{color:var(--text)}
        .ls-urlbar{display:flex;gap:8px;align-items:stretch}
        .ls-urlwrap{flex:1;display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--border2);border-radius:9px;padding:0 6px 0 12px;transition:border-color .2s}
        .ls-urlwrap:focus-within{border-color:var(--amber)}
        .ls-urlwrap.bad{border-color:rgba(248,113,113,.55)}
        .ls-linkicon{color:var(--text3);font-size:.9rem;flex-shrink:0}
        .ls-input{flex:1;background:none;border:none;outline:none;color:var(--text);font-family:'JetBrains Mono',monospace;font-size:.78rem;padding:10px 0;min-width:0}
        .ls-input::placeholder{color:var(--text3)}
        .ls-mini{flex-shrink:0;font-family:'Syne',sans-serif;font-size:.7rem;font-weight:600;padding:5px 10px;border-radius:6px;border:1px solid var(--border2);background:var(--bg3);color:var(--text2);cursor:pointer;transition:all .15s}
        .ls-mini:hover{border-color:var(--amber);color:var(--amber)}
        .ls-go{flex-shrink:0;font-family:'Syne',sans-serif;font-size:.78rem;font-weight:700;padding:0 18px;border-radius:9px;border:1px solid #38bdf8;background:#38bdf8;color:#06121a;cursor:pointer;transition:all .15s;white-space:nowrap}
        .ls-go:hover:not(:disabled){filter:brightness(1.1)}
        .ls-go:disabled{opacity:.55;cursor:wait}
        .ls-metarow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
        .ls-detect{font-size:.68rem;color:var(--text2);font-family:'JetBrains Mono',monospace}
        .ls-detect b{color:var(--text)}
        .ls-plats{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}
        .ls-plat{font-size:.66rem;font-weight:600;padding:3px 9px;border-radius:20px;border:1px solid var(--border2);background:var(--bg3);color:var(--text3);cursor:default;display:flex;align-items:center;gap:5px;transition:all .15s}
        .ls-plat.on{border-color:rgba(56,189,248,.5);color:#38bdf8;background:rgba(56,189,248,.1)}
        .ls-opts{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
        @media (max-width:720px){.ls-opts{grid-template-columns:1fr}.ls-urlbar{flex-direction:column}.ls-go{padding:10px}}
        .ls-optlabel{font-size:.63rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;display:block}
        .ls-seg{display:flex;gap:5px;flex-wrap:wrap}
        .ls-segbtn{font-family:'JetBrains Mono',monospace;font-size:.68rem;font-weight:600;padding:5px 11px;border-radius:7px;border:1px solid var(--border2);background:var(--bg3);color:var(--text2);cursor:pointer;transition:all .15s}
        .ls-segbtn:hover{border-color:var(--amber);color:var(--amber)}
        .ls-segbtn.on{background:rgba(56,189,248,.14);border-color:rgba(56,189,248,.55);color:#38bdf8}
        .ls-toggle{display:flex;border:1px solid var(--border2);border-radius:8px;overflow:hidden;width:max-content;max-width:100%}
        .ls-tbtn{font-size:.7rem;font-weight:700;padding:6px 14px;background:var(--bg3);color:var(--text3);border:none;cursor:pointer;font-family:'Syne',sans-serif;transition:all .15s}
        .ls-tbtn.on{background:rgba(56,189,248,.16);color:#38bdf8}
        .ls-samples{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:10px;font-size:.68rem;color:var(--text3)}
        .ls-dlgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:7px;margin-top:10px}
        .ls-dlrow{display:flex;align-items:center;gap:7px;border:1px solid var(--border2);background:var(--bg3);border-radius:8px;padding:6px 8px;cursor:pointer;transition:all .15s;font-family:'Syne',sans-serif;text-align:left;width:100%;color:var(--text)}
        .ls-dlrow:hover:not(:disabled){border-color:#38bdf8;background:rgba(56,189,248,.08)}
        .ls-dlrow:disabled{opacity:.6;cursor:wait}
        .ls-dlrow .q{font-family:'JetBrains Mono',monospace;font-size:.72rem;font-weight:700}
        .ls-dlrow .t{font-size:.62rem;color:var(--text3)}
        .ls-dlrow .st{margin-left:auto;font-size:.66rem;color:var(--text3);flex-shrink:0}
        .ls-dlrow.best{border-color:rgba(56,189,248,.55)}
        .ls-dlrow .unav{font-size:.58rem;color:var(--orange);border:1px solid rgba(251,146,60,.4);border-radius:4px;padding:0 4px}
        .ls-result{margin-top:14px;background:var(--bg);border:1px solid var(--border);border-radius:11px;overflow:hidden;animation:slideIn .2s ease}
        .ls-resgrid{display:grid;grid-template-columns:280px 1fr}
        @media (max-width:720px){.ls-resgrid{grid-template-columns:1fr}}
        .ls-thumb{position:relative;background:#000;min-height:160px;display:grid;place-items:center}
        .ls-thumb img{width:100%;height:100%;max-height:240px;object-fit:cover;display:block}
        .ls-thumb.none{color:var(--text3);font-size:2rem}
        .ls-badges{position:absolute;left:8px;bottom:8px;display:flex;gap:5px}
        .ls-title{font-size:.9rem;font-weight:700;color:var(--text);line-height:1.45;margin-bottom:5px;word-break:break-word}
        .ls-host{font-size:.68rem;color:var(--text3);font-family:'JetBrains Mono',monospace;margin-bottom:10px;word-break:break-all}
        .ls-body{padding:14px 16px}
        .ls-tags{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px}
        .ls-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
        .ls-dl{font-family:'Syne',sans-serif;font-size:.74rem;font-weight:700;padding:7px 16px;border-radius:7px;background:#38bdf8;color:#06121a;border:1px solid #38bdf8;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px;transition:all .15s}
        .ls-dl:hover{filter:brightness(1.12)}
        .ls-note{font-size:.7rem;color:var(--text2);background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:8px 11px;margin-top:10px;line-height:1.5}
        .ls-skel{margin-top:14px;border:1px solid var(--border);border-radius:11px;overflow:hidden}
        .ls-skelgrid{display:grid;grid-template-columns:280px 1fr}
        @media (max-width:720px){.ls-skelgrid{grid-template-columns:1fr}}
        .ls-shimmer{background:linear-gradient(100deg,var(--bg3) 40%,var(--bg4) 50%,var(--bg3) 60%);background-size:200% 100%;animation:lsSh 1.2s infinite linear;min-height:150px}
        @keyframes lsSh{to{background-position:-200% 0}}
        .ls-err{display:flex;gap:8px;align-items:flex-start;background:var(--red-dim);border:1px solid rgba(248,113,113,.3);color:var(--red);font-size:.74rem;border-radius:8px;padding:9px 12px;margin-top:10px;line-height:1.5}
        @keyframes slideIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      <p className="ls-sub">
        Save <b>public videos you have rights to</b> — paste a link, hit Fetch once,
        then pick any quality below. Cobalt first, yt-dlp fallback. Single videos
        only, 2&nbsp;GB cap. Respect platform ToS.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          resolve();
        }}
      >
        <div className="ls-urlbar">
          <div className={`ls-urlwrap${trimmed && !valid ? " bad" : ""}`}>
            <span className="ls-linkicon">🔗</span>
            <input
              className="ls-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              spellCheck={false}
              autoComplete="off"
              inputMode="url"
              aria-label="Video URL"
            />
            {url && (
              <button type="button" className="ls-mini" onClick={clear} title="Clear">
                ✕
              </button>
            )}
            <button type="button" className="ls-mini" onClick={paste} title="Paste from clipboard">
              ⎘ Paste
            </button>
          </div>
          <button type="submit" className="ls-go" disabled={loading || !trimmed}>
            {loading ? "⟳ Fetching…" : "⬇ Fetch"}
          </button>
        </div>
      </form>

      <div className="ls-metarow">
        <span className="ls-detect">
          {trimmed ? (
            valid ? (
              <>
                Detected: <b>{platformLabel(platform)}</b>
                {playlist && <span style={{ color: "var(--red)" }}> · playlist-blocked</span>}
              </>
            ) : (
              <span style={{ color: "var(--red)" }}>Not a valid http(s) URL</span>
            )
          ) : (
            "YouTube · TikTok · X · Instagram · Reddit · Vimeo"
          )}
        </span>
      </div>
      <div className="ls-plats" aria-hidden>
        {PLATFORMS.map((p) => (
          <span key={p.id} className={`ls-plat${platform === p.id ? " on" : ""}`}>
            <span>{p.icon}</span> {p.label}
          </span>
        ))}
      </div>

      <div className="ls-samples">
        <span>Try:</span>
        {SAMPLES.map((s) => (
          <button key={s.label} type="button" className="ls-mini" onClick={() => setUrl(s.url)}>
            {s.label}
          </button>
        ))}
      </div>

      {error && !loading && (
        <div className="ls-err">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}
      {loading ? (
        <div className="ls-skel">
          <div className="ls-skelgrid">
            <div className="ls-shimmer" />
            <div style={{ padding: 16 }}>
              <div className="ls-shimmer" style={{ minHeight: 18, borderRadius: 6, marginBottom: 10 }} />
              <div className="ls-shimmer" style={{ minHeight: 12, borderRadius: 6, width: "55%" }} />
            </div>
          </div>
        </div>
      ) : data ? (
        <div className="ls-result">
          <div className="ls-resgrid">
            <div className={`ls-thumb${data.thumbnail ? "" : " none"}`}>
              {data.thumbnail ? (
                <img src={data.thumbnail} alt="" loading="lazy" />
              ) : (
                <span>🎬</span>
              )}
              <div className="ls-badges">
                <QTag kind="pin">{platformLabel(data.platform)}</QTag>
                <QTag kind={data.source === "cobalt" ? "begin" : "select"}>{data.source}</QTag>
                {data.duration ? (
                  <QTag kind="pin">
                    {Math.floor(data.duration / 60)}:{String(Math.floor((data.duration ?? 0) % 60)).padStart(2, "0")}
                  </QTag>
                ) : null}
              </div>
            </div>
            <div className="ls-body">
              <div className="ls-title">{data.title || "(no title returned)"}</div>
              <div className="ls-host">{trimmed}</div>
              <div className="ls-tags">
                <QTag kind="begin">single video</QTag>
                <QTag kind="select">≤ 2 GB</QTag>
                {videoVariants.length > 0 && (
                  <QTag kind="pin">{videoVariants.length} qualities</QTag>
                )}
              </div>
              {videoVariants.length > 0 && (
                <>
                  <span className="ls-optlabel">Video — pick a quality, no re-fetch</span>
                  <div className="ls-dlgrid">
                    {videoVariants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className={`ls-dlrow${v.available === false ? "" : " best"}`}
                        onClick={() => downloadVariant(v)}
                        disabled={dlId !== null}
                        title={v.available === false ? "Above source max — yt-dlp serves closest match" : `Download ${v.label}`}
                      >
                        <span className="q">⬇ {v.label}</span>
                        {v.available === false && <span className="unav">~max</span>}
                        <span className="st">
                          {dlId === v.id ? "⟳…" : dlDone === v.id ? "✓" : "mp4"}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {audioVariant && (
                <>
                  <span className="ls-optlabel" style={{ marginTop: 8 }}>Audio</span>
                  <div className="ls-dlgrid">
                    <button
                      type="button"
                      className="ls-dlrow best"
                      onClick={() => downloadVariant(audioVariant)}
                      disabled={dlId !== null}
                      title="Download MP3 audio"
                    >
                      <span className="q">🎵 {audioVariant.label}</span>
                      <span className="st">
                        {dlId === audioVariant.id ? "⟳…" : dlDone === audioVariant.id ? "✓" : "mp3"}
                      </span>
                    </button>
                    {directHref && (
                      <a
                        className="ls-dlrow"
                        href={directHref}
                        target="_blank"
                        rel="noreferrer"
                        title="Direct CDN link from resolver"
                        style={{ textDecoration: "none" }}
                      >
                        <span className="q">↗ Direct</span>
                        <span className="st">cdn</span>
                      </a>
                    )}
                  </div>
                </>
              )}
              <div className="ls-actions">
                {variants.length > 0 && (
                  <CopyBtn text={window.location.origin + variants[2].download_endpoint} />
                )}
                <button
                  type="button"
                  className="ls-mini"
                  onClick={() => {
                    if (trimmed) window.open(trimmed, "_blank", "noreferrer");
                  }}
                >
                  ↗ Open source
                </button>
                <button type="button" className="ls-mini" onClick={clear}>
                  ✕ New link
                </button>
              </div>
              {dlError && (
                <div className="ls-err" style={{ marginTop: 8 }}>
                  <span>⚠</span>
                  <span>Download failed: {dlError}</span>
                </div>
              )}
              {!variants.length && !directHref && (
                <div className="ls-note">
                  Resolver returned metadata only
                  {data.formats && data.formats.length > 0
                    ? ` (${data.formats.length} formats seen).`
                    : "."}{" "}
                  The backend download link is missing — re-fetch the URL.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        !error && (
          <div style={{ marginTop: 12, border: "1px dashed var(--border2)", borderRadius: 11 }}>
            <Empty icon="🔗" text="Nothing fetched yet" hint="Paste a video link above and hit Fetch — the preview lands here." />
          </div>
        )
      )}
    </UtilShell>
  );
}

export default LinkSaverPanel;
