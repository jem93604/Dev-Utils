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

/** Drop playlist tracking (list/index) so a playlist URL resolves as a single video. */
export function stripPlaylistParams(url: string): string {
  try {
    const u = new URL(url.trim());
    u.searchParams.delete("list");
    u.searchParams.delete("index");
    return u.toString();
  } catch {
    return url;
  }
}

/** Human expiry label for zero-egress direct URLs (5-6 min typical, 1h max). */
export function formatExpiry(expiresIn?: number | null): string | null {
  if (expiresIn == null || !Number.isFinite(expiresIn)) return null;
  if (expiresIn <= 0) return "expired — re-fetch";
  if (expiresIn < 60) return `use within ${Math.max(1, Math.round(expiresIn))}s`;
  const mins = Math.round(expiresIn / 60);
  if (mins < 60) return `use within ~${mins} min`;
  return `use within ~${Math.round(mins / 60)}h`;
}

export interface DirectVariantLike {
  redirect_endpoint?: string | null;
  direct_url?: string | null;
  needs_mux?: boolean | null;
}

/** Preferred zero-egress href: redirect first (hides signatures), raw URL fallback. */
export function directHrefFor(v: DirectVariantLike): string | null {
  return v.redirect_endpoint ?? v.direct_url ?? null;
}

/** True when a variant can download without touching server egress. */
export function isZeroEgress(v: DirectVariantLike): boolean {
  return Boolean(v.redirect_endpoint ?? v.direct_url);
}
