import { useState } from "react";
import { api } from "../../lib/api";
import { detectPlatform, isBlockedMediaUrl, isPlaylistUrl, isValidMediaUrl } from "./lib";
import { ErrMsg, UtilShell } from "../ui";

interface Resolved {
  platform: string;
  title: string;
  thumbnail: string;
  source: string;
  download_url: string | null;
}

const QUALITIES = ["360", "480", "720", "1080", "1440", "2160"];

export function LinkSaverPanel() {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState("720");
  const [audioOnly, setAudioOnly] = useState(false);
  const [data, setData] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const resolve = async () => {
    setError(undefined);
    setData(null);
    if (!isValidMediaUrl(url)) {
      setError("Enter a valid http(s) URL");
      return;
    }
    if (isBlockedMediaUrl(url)) {
      setError("That host is not allowed (internal/local addresses are blocked)");
      return;
    }
    if (isPlaylistUrl(url)) {
      setError("Playlists not supported in v1 — paste a single video URL");
      return;
    }
    setLoading(true);
    try {
      // api client attaches the Bearer token; raw fetch would send none
      // and /media/resolve (authenticated) would 401 for logged-in users.
      const r = await api.post("/media/resolve", {
        url: url.trim(),
        quality,
        audio_only: audioOnly,
      });
      setData(r.data as Resolved);
    } catch (e) {
      const detail = (e as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
      const msg =
        typeof detail?.data?.detail === "string"
          ? detail.data.detail
          : e instanceof Error
            ? e.message
            : "Resolve failed";
      // Don't leak raw backend internals; show status for non-422/429 cases.
      setError(detail?.status && detail.status >= 500 ? "Resolve failed — upstream unavailable" : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <UtilShell id="util-linksaver" color="#38bdf8" title="🔗 Link Saver">
      <p style={{ fontSize: 12, opacity: 0.8 }}>
        Only download public content you have rights to. Respect platform ToS. Cobalt public first,
        yt-dlp fallback. Single video only, 2GB cap.
      </p>
      <div className="fmt-grid">
        <div className="fmt-col">
          <label>Video URL (YouTube, TikTok, X, Instagram, Reddit, Vimeo)</label>
          <input
            className="fmt-input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            spellCheck={false}
          />
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Detected: {url ? detectPlatform(url) : "—"}
          </div>
          <label>Quality</label>
          <select className="fmt-input" value={quality} onChange={(e) => setQuality(e.target.value)}>
            {QUALITIES.map((q) => (
              <option key={q} value={q}>
                {q}p{audioOnly ? " (audio)" : ""}
              </option>
            ))}
          </select>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={audioOnly} onChange={(e) => setAudioOnly(e.target.checked)} />
            Audio only (mp3)
          </label>
          <div className="fmt-btns">
            <button className="fmt-btn" onClick={resolve} disabled={loading}>
              {loading ? "Resolving…" : "Resolve"}
            </button>
            <button
              className="fmt-btn"
              onClick={() => {
                setUrl("");
                setData(null);
              }}
            >
              ✕ Clear
            </button>
          </div>
          <ErrMsg msg={error} />
        </div>
        <div className="fmt-col">
          <label>Result</label>
          {data ? (
            <div>
              {data.thumbnail ? (
                <img src={data.thumbnail} alt="" style={{ maxWidth: "100%", borderRadius: 8 }} />
              ) : null}
              <div style={{ fontWeight: 600, marginTop: 8 }}>{data.title || "(no title)"}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {data.platform} · via {data.source}
              </div>
              {data.download_url ? (
                <a className="fmt-btn" href={data.download_url} download style={{ marginTop: 8, display: "inline-block" }}>
                  ⬇ Download
                </a>
              ) : (
                <div style={{ fontSize: 12, marginTop: 8 }}>
                  No direct URL (yt-dlp fallback) — backend streaming lands in next iteration.
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.6 }}>Nothing resolved yet.</div>
          )}
        </div>
      </div>
    </UtilShell>
  );
}

export default LinkSaverPanel;
