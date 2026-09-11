import { describe, expect, it } from "vitest";
import { detectPlatform, isPlaylistUrl, isValidMediaUrl } from "./lib";

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
});
