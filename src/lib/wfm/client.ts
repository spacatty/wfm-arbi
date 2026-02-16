import { getRateLimiter } from "./rate-limiter";
import type { TokenBucket } from "./rate-limiter";
import nodeFetch from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import type { Agent } from "node:http";
import type {
  WfmApiResponse,
  WfmRivenItemsPayload,
  WfmRivenAttributesPayload,
  WfmAuctionsPayload,
  WfmAuctionEntry,
  WfmProfileAuctionEntry,
  WfmProfileAuctionsPayload,
  WfmRivenItem,
  WfmRivenAttribute,
  WfmStatisticsPayload,
} from "./types";

const BASE_URL = process.env.WFM_API_BASE_URL || "https://api.warframe.market/v1";
const BASE_URL_V2 = (process.env.WFM_API_BASE_URL || "https://api.warframe.market/v1").replace(/\/v1\/?$/, "/v2");
const PLATFORM = process.env.WFM_PLATFORM || "pc";

export interface WfmFetchOpts {
  limiter?: TokenBucket;
  proxyUrl?: string;
}

/** Thrown when the error is specific to the proxy (bad cert, refused, 403). */
export class ProxyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProxyError";
  }
}

/**
 * True if the error indicates a rate limit (429) or server overload (503) or exhausted retries.
 * Use this to decide whether to retry with another proxy; do not retry on 404 or other client errors.
 */
export function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|503|rate limit|All retries exhausted/i.test(msg);
}

/** Error codes that indicate the proxy itself is broken, not the target. */
const PROXY_FAIL_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EPIPE",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "CERT_HAS_EXPIRED",
]);

/**
 * Build an HTTP agent for the given proxy URL.
 * Supports http://, https://, socks4://, socks5://, socks:// protocols.
 */
function buildProxyAgent(proxyUrl: string): Agent {
  if (
    proxyUrl.startsWith("socks://") ||
    proxyUrl.startsWith("socks4://") ||
    proxyUrl.startsWith("socks5://") ||
    proxyUrl.startsWith("socks4a://") ||
    proxyUrl.startsWith("socks5h://")
  ) {
    return new SocksProxyAgent(proxyUrl) as unknown as Agent;
  }
  return new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false }) as unknown as Agent;
}


/**
 * Rate-limited fetch wrapper for the WFM API.
 *
 * When using a proxy:
 *  - TLS cert verification is disabled (SOCKS proxies often MITM)
 *  - Connection-level errors throw ProxyError immediately (no retry)
 *  - 403 Forbidden throws ProxyError immediately (IP is blocked)
 *  - 429 / 503 still retry with backoff
 *
 * When not using a proxy:
 *  - Standard retry logic for all errors
 */
async function wfmFetch<T>(
  path: string,
  retries = 3,
  opts: WfmFetchOpts = {}
): Promise<T> {
  const limiter = opts.limiter ?? getRateLimiter();
  await limiter.acquire();

  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Platform: PLATFORM,
    Language: "en",
    Accept: "application/json",
  };

  const agent = opts.proxyUrl ? buildProxyAgent(opts.proxyUrl) : undefined;
  const isProxied = !!opts.proxyUrl;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await nodeFetch(url, { headers, agent });

      if (res.status === 429) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.warn(`[WFM] Rate limited on ${path}, retrying in ${backoff}ms...`);
        await new Promise((r) => setTimeout(r, backoff));
        await limiter.acquire();
        continue;
      }

      // 403 on a proxied request = WFM blocked that proxy IP. Don't retry.
      if (res.status === 403 && isProxied) {
        throw new ProxyError(`Proxy blocked by WFM (403) on ${path}`);
      }

      // 503 = server overloaded, worth retrying
      if (res.status === 503) {
        if (attempt < retries) {
          const backoff = Math.pow(2, attempt + 1) * 1000;
          console.warn(`[WFM] 503 on ${path}, retrying in ${backoff}ms...`);
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
        throw new Error(`WFM API error: 503 ${res.statusText} on ${path}`);
      }

      if (!res.ok) {
        throw new Error(`WFM API error: ${res.status} ${res.statusText} on ${path}`);
      }

      const json = await res.json();
      return json as T;
    } catch (err: unknown) {
      // If it's already a ProxyError, propagate immediately (no retry)
      if (err instanceof ProxyError) throw err;

      // Check if this is a proxy-specific connection failure
      const errCode = (err as { code?: string }).code;
      if (isProxied && errCode && PROXY_FAIL_CODES.has(errCode)) {
        throw new ProxyError(`Proxy connection failed (${errCode}) on ${path}`);
      }

      if (attempt === retries) throw err;
      const backoff = Math.pow(2, attempt + 1) * 1000;
      console.warn(`[WFM] Request failed for ${path}, retrying in ${backoff}ms...`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }

  throw new Error(`[WFM] All retries exhausted for ${path}`);
}

/**
 * Get all riven-eligible weapons
 */
export async function getRivenItems(): Promise<WfmRivenItem[]> {
  const data = await wfmFetch<WfmApiResponse<WfmRivenItemsPayload>>("/riven/items");
  return data.payload.items;
}

/**
 * Get all riven attributes
 */
export async function getRivenAttributes(): Promise<WfmRivenAttribute[]> {
  const data = await wfmFetch<WfmApiResponse<WfmRivenAttributesPayload>>("/riven/attributes");
  return data.payload.attributes;
}

/**
 * Full filter options for riven auction search.
 */
export interface RivenSearchFilters {
  weaponUrlName: string;
  positiveStats?: string[];
  negativeStats?: string[];
  polarity?: string;
  masteryRankMin?: number;
  masteryRankMax?: number;
  reRollsMin?: number;
  reRollsMax?: number;
  sortBy?: string;
  buyoutPolicy?: string;
  limiter?: TokenBucket;
  proxyUrl?: string;
}

/**
 * Search riven auctions for a specific weapon with optional advanced filters.
 * Single request only (no limit/offset) to avoid rate limits.
 */
export async function searchRivenAuctions(
  weaponUrlName: string,
  options: Partial<Omit<RivenSearchFilters, "weaponUrlName">> = {}
): Promise<WfmAuctionEntry[]> {
  const {
    sortBy = "price_asc",
    buyoutPolicy = "direct",
    positiveStats,
    negativeStats,
    polarity,
    masteryRankMin,
    masteryRankMax,
    reRollsMin,
    reRollsMax,
    limiter,
    proxyUrl,
  } = options;

  const params = new URLSearchParams({
    type: "riven",
    weapon_url_name: weaponUrlName,
    sort_by: sortBy,
    buyout_policy: buyoutPolicy,
  });

  if (positiveStats?.length) {
    params.set("positive_stats", positiveStats.join(","));
  }
  if (negativeStats?.length) {
    params.set("negative_stats", negativeStats.join(","));
  }
  if (polarity && polarity !== "any") {
    params.set("polarity", polarity);
  }
  if (masteryRankMin != null) {
    params.set("mastery_rank_min", String(masteryRankMin));
  }
  if (masteryRankMax != null) {
    params.set("mastery_rank_max", String(masteryRankMax));
  }
  if (reRollsMin != null) {
    params.set("re_rolls_min", String(reRollsMin));
  }
  if (reRollsMax != null) {
    params.set("re_rolls_max", String(reRollsMax));
  }
  /* WFM API has no mod_rank filter; we never filter by rank so r0 + high rerolls (e.g. 100+) are included */

  const data = await wfmFetch<WfmApiResponse<WfmAuctionsPayload>>(
    `/auctions/search?${params.toString()}`,
    3,
    { limiter, proxyUrl }
  );

  return data.payload.auctions;
}

/**
 * Search recent riven auctions (no weapon filter).
 */
export async function searchRecentRivenAuctions(): Promise<WfmAuctionEntry[]> {
  try {
    const data = await wfmFetch<WfmApiResponse<WfmAuctionsPayload>>(
      "/auctions/search?type=riven&sort_by=price_asc&buyout_policy=direct"
    );
    return data.payload.auctions;
  } catch {
    console.warn("[WFM] Broad riven auction search not supported");
    return [];
  }
}

/**
 * Get item statistics (closed/live, 48h and 90d) for mod price by rank.
 * Used for investment dashboard: r0 vs r10 prices.
 */
export async function getItemStatistics(
  itemUrlName: string,
  opts: WfmFetchOpts = {}
): Promise<WfmStatisticsPayload> {
  const encoded = encodeURIComponent(itemUrlName);
  const data = await wfmFetch<WfmApiResponse<WfmStatisticsPayload>>(
    `/items/${encoded}/statistics`,
    3,
    opts
  );
  return data.payload;
}

/**
 * Fetch a single riven auction by WFM auction id.
 * Uses GET /auctions/:id when available. Returns null if not found or API does not support it.
 */
export async function getAuctionById(
  auctionId: string,
  opts: WfmFetchOpts = {}
): Promise<WfmAuctionEntry | null> {
  const limiter = opts.limiter ?? getRateLimiter();
  await limiter.acquire();
  const url = `${BASE_URL}/auctions/${encodeURIComponent(auctionId)}`;
  const headers: Record<string, string> = {
    Platform: PLATFORM,
    Language: "en",
    Accept: "application/json",
  };
  try {
    const agent = opts.proxyUrl ? buildProxyAgent(opts.proxyUrl) : undefined;
    const res = await nodeFetch(url, { headers, agent });
    if (res.status === 429) throw new Error("WFM API rate limit (429)");
    if (res.status === 404 || !res.ok) {
      console.warn(
        `[WFM] getAuctionById failed: ${res.status} ${res.statusText} | url=${url} | auctionId=${auctionId}`
      );
      return null;
    }
    const json = await res.json();
    const payload = (json as WfmApiResponse<WfmAuctionEntry>).payload;
    return payload ?? null;
  } catch (e) {
    if (e instanceof Error && isRateLimitError(e)) throw e;
    console.warn(`[WFM] getAuctionById error: url=${url} | auctionId=${auctionId}`, e);
    return null;
  }
}

/**
 * Fetch a user's auctions from profile (GET /v1/profile/:slug/auctions).
 * Used by watch poller to get current price and item for endo recalc.
 * Slug is typically the owner's ingame_name.
 */
export async function getProfileAuctions(
  ownerSlug: string,
  opts: WfmFetchOpts = {}
): Promise<WfmProfileAuctionEntry[]> {
  if (!ownerSlug?.trim()) return [];
  const slug = ownerSlug.trim();
  const path = `/profile/${encodeURIComponent(slug)}/auctions`;
  const data = await wfmFetch<WfmApiResponse<WfmProfileAuctionsPayload>>(path, 3, opts);
  return data.payload?.auctions ?? [];
}

/**
 * Fetch multiple riven auctions by searching per weapon and matching ids.
 * Use when getAuctionById is not available or for batching. Groups by weaponUrlName.
 */
export async function getAuctionsByWeaponAndIds(
  weaponUrlName: string,
  auctionIds: Set<string>,
  opts: WfmFetchOpts = {}
): Promise<WfmAuctionEntry[]> {
  if (auctionIds.size === 0) return [];
  const auctions = await searchRivenAuctions(weaponUrlName, {
    sortBy: "price_asc",
    buyoutPolicy: "direct",
    ...opts,
  });
  return auctions.filter((a) => auctionIds.has(a.id));
}

/** V2 user API response shape (GET /v2/user/:slug) */
interface WfmUserPayload {
  id?: string;
  ingameName?: string;
  slug?: string;
  lastSeen?: string | null;
}

/**
 * Fetch user lastSeen from WFM v2 user API. Returns null if not found or no lastSeen.
 * Slug is typically the ingame_name.
 */
export async function getUserLastSeen(
  slug: string,
  opts: WfmFetchOpts = {}
): Promise<Date | null> {
  if (!slug?.trim()) return null;
  const limiter = opts.limiter ?? getRateLimiter();
  await limiter.acquire();
  const url = `${BASE_URL_V2}/user/${encodeURIComponent(slug.trim())}`;
  const headers: Record<string, string> = {
    Platform: PLATFORM,
    Language: "en",
    Accept: "application/json",
  };
  try {
    const agent = opts.proxyUrl ? buildProxyAgent(opts.proxyUrl) : undefined;
    const res = await nodeFetch(url, { headers, agent });
    if (res.status === 429) throw new Error("WFM API rate limit (429)");
    if (res.status === 404 || !res.ok) return null;
    const json = (await res.json()) as { data?: WfmUserPayload };
    const lastSeen = json.data?.lastSeen;
    if (typeof lastSeen !== "string") return null;
    const d = new Date(lastSeen);
    return Number.isFinite(d.getTime()) ? d : null;
  } catch (e) {
    if (e instanceof Error && isRateLimitError(e)) throw e;
    return null;
  }
}
