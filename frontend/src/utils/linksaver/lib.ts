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

const BLOCKED_SUFFIXES = [".local", ".internal", ".lan", ".localhost", ".invalid"];
const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "metadata.google.com"]);

function isBlockedIp(host: string): boolean {
  // IPv4 literal check (no DNS needed client-side).
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 127 || a === 169 && b === 254) return true; // loopback / link-local (IMDS)
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 0 || a >= 224) return true; // unspecified / multicast / reserved
    return false;
  }
  // IPv6 loopback / unspecified / link-local / unique-local.
  const h = host.toLowerCase();
  return h === "::1" || h === "::" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd");
}

/** Mirror of the backend SSRF guard — fail fast in the UI before the request. */
export function isBlockedMediaUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return true;
    const host = u.hostname.toLowerCase();
    if (!host || BLOCKED_HOSTS.has(host)) return true;
    if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return true;
    return isBlockedIp(host);
  } catch {
    return true;
  }
}
