export const PLATFORM_HOSTS: Record<string, string[]> = {
  youtube: ["youtube.com", "youtu.be", "music.youtube.com"],
  tiktok: ["tiktok.com", "vt.tiktok.com"],
  twitter: ["twitter.com", "x.com", "t.co"],
  instagram: ["instagram.com"],
  reddit: ["reddit.com", "redd.it"],
  vimeo: ["vimeo.com"],
};

export function detectPlatform(url: string): string {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    for (const [id, hosts] of Object.entries(PLATFORM_HOSTS)) {
      if (hosts.some((h) => host === h || host.endsWith("." + h))) return id;
    }
  } catch {
    return "unknown";
  }
  return "generic";
}

export function isValidMediaUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isPlaylistUrl(url: string): boolean {
  try {
    return new URL(url.trim()).searchParams.has("list");
  } catch {
    return false;
  }
}
