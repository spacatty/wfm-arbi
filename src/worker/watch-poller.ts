/**
 * Watch poller — uses GET /v1/profile/:slug/auctions to get current auction data,
 * then GET /v2/user/:slug for last_seen. Recalculates endo from profile item + price.
 * Run periodically from the main worker when watch settings have running=true.
 */

import { db } from "../lib/db";
import {
  watchedAuctions,
  watchEvents,
  watchSettings,
} from "../lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSetting } from "../lib/db/settings";
import { getProfileAuctions, getUserLastSeen, isRateLimitError } from "../lib/wfm/client";
import { getRateLimiter } from "../lib/wfm/rate-limiter";
import { ProxyManager, loadAliveProxies } from "../lib/proxy-manager";
import { getBenchmarksFromDB } from "../lib/db/settings";
import { analyzeRiven } from "../lib/endo";

const MAX_PROXY_RETRIES = 10;
const RETRY_SLEEP_BASE_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type WatchPollOptions = { onStartup?: boolean };

export async function runWatchPoll(opts?: WatchPollOptions): Promise<{ checked: number; events: number }> {
  const skipIntervalCheck = opts?.onStartup === true;
  const now = new Date();

  // Atomic claim: only one runner wins per interval. Update lastRunAt only when running=true and (onStartup or interval elapsed).
  const [claimed] = skipIntervalCheck
    ? await db
        .update(watchSettings)
        .set({ lastRunAt: now })
        .where(eq(watchSettings.running, true))
        .returning({ id: watchSettings.id })
    : await db
        .update(watchSettings)
        .set({ lastRunAt: now })
        .where(
          sql`${watchSettings.running} = true and (${watchSettings.lastRunAt} is null or extract(epoch from (now() - ${watchSettings.lastRunAt})) >= ${watchSettings.pollIntervalSeconds})`
        )
        .returning({ id: watchSettings.id });

  if (!claimed) {
    return { checked: 0, events: 0 };
  }

  const list = await db.select().from(watchedAuctions);
  if (list.length === 0) {
    return { checked: 0, events: 0 };
  }

  const useProxies = (await getSetting("use_proxies")) === "true";
  let proxyManager: ProxyManager | null = null;
  if (useProxies) {
    const alive = await loadAliveProxies();
    proxyManager = new ProxyManager(alive);
    if (proxyManager.count === 0) proxyManager = null;
  }

  const globalLimiter = getRateLimiter();
  const benchmarks = await getBenchmarksFromDB();
  let eventsCreated = 0;

  const byOwner = new Map<string, typeof list>();
  for (const wa of list) {
    const key = wa.ownerIgn.trim().toLowerCase();
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key)!.push(wa);
  }

  for (const [ownerKey, ownerWatched] of byOwner) {
    const ownerIgn = ownerWatched[0].ownerIgn;
    let lastError: unknown;
    let done = false;

    for (let attempt = 0; attempt <= MAX_PROXY_RETRIES && !done; attempt++) {
      const proxyWithLimiter = proxyManager ? await proxyManager.checkout() : null;
      const limiter = proxyWithLimiter?.limiter ?? globalLimiter;
      const proxyUrl = proxyWithLimiter?.proxy.url;

      try {
        const [profileAuctions, sellerLastSeenAt] = await Promise.all([
          getProfileAuctions(ownerIgn, { limiter, proxyUrl }),
          getUserLastSeen(ownerIgn, { limiter, proxyUrl }),
        ]);

        const auctionById = new Map(profileAuctions.map((a) => [a.id, a]));

        // Remove auctions that are no longer in the profile (404 / sold / expired) and create event
        for (const wa of ownerWatched) {
          const pa = auctionById.get(wa.wfmAuctionId);
          if (!pa) {
            await db.insert(watchEvents).values({
              watchedAuctionId: wa.id,
              kind: "removed_404",
              previousValue: "Removed due to 404",
              currentValue: null,
              weaponName: wa.weaponName,
              ownerIgn: wa.ownerIgn,
              rivenName: wa.rivenName ?? null,
            });
            eventsCreated++;
            await db.delete(watchedAuctions).where(eq(watchedAuctions.id, wa.id));
            continue;
          }
        }

        for (const wa of ownerWatched) {
          const pa = auctionById.get(wa.wfmAuctionId);
          if (!pa) continue;

          const newBuyout = pa.buyout_price ?? null;
          const newStarting = pa.starting_price ?? null;
          const prevBuyout = wa.lastBuyoutPrice;
          const prevStarting = wa.lastStartingPrice;

          const prevNum = prevBuyout != null ? Number(prevBuyout) : null;
          const newNum = newBuyout != null ? Number(newBuyout) : null;
          const buyoutChanged = prevNum !== newNum && (prevNum != null || newNum != null);
          if (buyoutChanged) {
            const prevStr = prevBuyout != null ? String(prevBuyout) : null;
            const newStr = newBuyout != null ? String(newBuyout) : null;
            const [existing] = await db
              .select({ id: watchEvents.id })
              .from(watchEvents)
              .where(
                and(
                  eq(watchEvents.watchedAuctionId, wa.id),
                  eq(watchEvents.kind, "price_change"),
                  eq(watchEvents.previousValue, prevStr),
                  eq(watchEvents.currentValue, newStr)
                )
              )
              .limit(1);
            if (!existing) {
              await db.insert(watchEvents).values({
                watchedAuctionId: wa.id,
                kind: "price_change",
                previousValue: prevStr,
                currentValue: newStr,
              });
              eventsCreated++;
            }
          }

          const masteryLevel = pa.item?.mastery_level ?? 8;
          const modRank = pa.item?.mod_rank ?? 0;
          const reRolls = pa.item?.re_rolls ?? 0;
          const price = newBuyout ?? 0;
          const analysis = analyzeRiven(masteryLevel, modRank, reRolls, price, benchmarks);
          const lastEndoPerPlat = Math.round(analysis.endoPerPlat);
          const lastEndoValue = analysis.endoValue;

          await db
            .update(watchedAuctions)
            .set({
              lastBuyoutPrice: newBuyout,
              lastStartingPrice: newStarting,
              lastEndoPerPlat,
              lastEndoValue,
              lastCheckedAt: new Date(),
              ...(sellerLastSeenAt !== null && { sellerLastSeenAt }),
            })
            .where(eq(watchedAuctions.id, wa.id));
        }

        if (proxyWithLimiter) {
          await proxyManager!.markSuccess(proxyWithLimiter.proxy.id);
          proxyManager!.checkin(proxyWithLimiter.proxy.id);
        }
        done = true;
      } catch (err) {
        lastError = err;
        if (proxyWithLimiter) {
          await proxyManager!.markFailed(proxyWithLimiter.proxy.id);
        }
        if (isRateLimitError(err) && attempt < MAX_PROXY_RETRIES) {
          console.warn(
            `[Watch] Rate limit for profile ${ownerIgn} (attempt ${attempt + 1}/${MAX_PROXY_RETRIES}):`,
            err instanceof Error ? err.message : err
          );
          await sleep(Math.min(5000, RETRY_SLEEP_BASE_MS * Math.pow(2, attempt)));
          continue;
        }
        const msg = lastError instanceof Error ? lastError.message : String(lastError);
        if (!msg.includes("404") && !msg.includes("null")) {
          console.warn(`[Watch] Poll failed for profile ${ownerIgn} after ${attempt + 1} attempt(s):`, lastError);
        }
        break;
      }
    }
  }

  return { checked: list.length, events: eventsCreated };
}
