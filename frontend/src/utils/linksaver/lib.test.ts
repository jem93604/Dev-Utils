import { describe, expect, it } from "vitest";
import { detectPlatform, isBlockedMediaUrl, isPlaylistUrl, isValidMediaUrl } from "./lib";

describe("linksaver lib", () => {
  it("detects youtube/tiktok/x", () => {
    expect(detectPlatform("https://www.youtube.com/watch?v=x")).toBe("youtube");
    expect(detectPlatform("https://youtu.be/x")).toBe("youtube");
    expect(detectPlatform("https://www.tiktok.com/@a/video/1")).toBe("tiktok");
    expect(detectPlatform("https://x.com/u/status/1")).toBe("twitter");
  });

  it("validates urls", () => {
    expect(isValidMediaUrl("https://vimeo.com/1")).toBe(true);
    expect(isValidMediaUrl("not-a-url")).toBe(false);
  });

  it("flags playlists", () => {
    expect(isPlaylistUrl("https://www.youtube.com/watch?v=x&list=PL1")).toBe(true);
    expect(isPlaylistUrl("https://www.youtube.com/watch?v=x")).toBe(false);
  });

  it("handles youtu.be share links with si param (download case)", () => {
    const share = "https://youtu.be/dQw4w9WgXcQ?si=soOTn3G2tEVN9d6A";
    expect(detectPlatform(share)).toBe("youtube");
    expect(isValidMediaUrl(share)).toBe(true);
    // si= is a share-tracking param, not a playlist — must not be rejected
    expect(isPlaylistUrl(share)).toBe(false);
  });

  it("blocks internal/local hosts (SSRF mirror of backend guard)", () => {
    expect(isBlockedMediaUrl("https://www.youtube.com/watch?v=x")).toBe(false);
    expect(isBlockedMediaUrl("http://localhost:8001/admin")).toBe(true);
    expect(isBlockedMediaUrl("http://127.0.0.1:8001/")).toBe(true);
    expect(isBlockedMediaUrl("http://10.0.0.5/")).toBe(true);
    expect(isBlockedMediaUrl("http://192.168.1.1/")).toBe(true);
    expect(isBlockedMediaUrl("http://169.254.169.254/latest/meta-data/")).toBe(true);
    expect(isBlockedMediaUrl("http://metadata.google.internal/")).toBe(true);
    expect(isBlockedMediaUrl("http://printer.local/")).toBe(true);
    expect(isBlockedMediaUrl("ftp://example.com/x")).toBe(true);
    expect(isBlockedMediaUrl("not-a-url")).toBe(true);
  });
});
