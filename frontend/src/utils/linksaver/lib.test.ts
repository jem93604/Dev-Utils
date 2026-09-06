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
});
