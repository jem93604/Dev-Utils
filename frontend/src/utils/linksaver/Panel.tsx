import { useState } from "react";
import { detectPlatform, isValidMediaUrl, stripPlaylistParams } from "./lib";
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
    setLoading(true);
    try {
      const r = await fetch("/api/v1/media/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: stripPlaylistParams(url), quality, audio_only: audioOnly }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error((d as { detail?: string }).detail ?? `Resolve failed (${r.status})`);
      }
      setData((await r.json()) as Resolved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <UtilShell id="util-linksaver" color="#38bdf8" title="🔗 Link Saver">
      <p style={{ fontSize: 12, opacity: 0.8 }}>
        Only download public content you have rights to. Respect platform ToS. Cobalt public first,
        yt-dlp fallback. Playlist links resolve as a single video, 2GB cap.
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
