import { db } from "../lib/db";
import { rivenSnapshots, scanJobs } from "../lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { searchRivenAuctions, getRivenItems, isRateLimitError } from "../lib/wfm/client";
import { getRateLimiter } from "../lib/wfm/rate-limiter";
import { analyzeRiven } from "../lib/endo";
import { getBenchmarksFromDB, getSetting } from "../lib/db/settings";
import { buildScanQueue, seedWeaponScanLog, updateWeaponTier } from "./queue";
import { ProxyManager, loadAliveProxies } from "../lib/proxy-manager";
import type { WfmAuctionEntry } from "../lib/wfm/types";
import type { ScanJob } from "../lib/db/schema";
import type { ScanQueueItem } from "./queue";

const PAUSE_POLL_MS = 2000;

/**
 * Check if there's already an active scan (running or paused).
 */
export async function getActiveScan(): Promise<ScanJob | null> {
  const [job] = await db
    .select()
    .from(scanJobs)
    .where(sql`${scanJobs.status} IN ('running', 'paused')`)
    .orderBy(desc(scanJobs.startedAt))
    .limit(1);
  return job ?? null;
}

/**
 * Run a full scan cycle with concurrent workers.
 * Uses proxies and per-proxy rate limiters when use_proxies is true; otherwise 1 worker with global limiter.
 */
export async function runScan(
  trigger: "manual" | "auto" = "auto"
): Promise<string> {
  const active = await getActiveScan();
  if (active) {
    console.log("[Scanner] Scan already active, skipping...");
    return active.id;
  }

  const benchmarks = await getBenchmarksFromDB();
  const useProxies = (await getSetting("use_proxies")) === "true";
  let workerCount = Math.min(15, Math.max(1, parseInt((await getSetting("worker_count")) || "5", 10) || 5));

  let proxyManager: ProxyManager | null = null;
  if (useProxies) {
    const alive = await loadAliveProxies();
    proxyManager = new ProxyManager(alive);
    if (proxyManager.count === 0) {
      console.log("[Scanner] Use proxies enabled but no alive proxies; falling back to 1 worker.");
      workerCount = 1;
      proxyManager = null;
    } else {
      workerCount = Math.min(workerCount, Math.max(1, proxyManager.count));
    }
  } else {
    workerCount = 1;
  }

  // Rank Value: use full WFM riven/items list (maximum guns across all Warframe market data)
  const weapons = await getRivenItems();
  await seedWeaponScanLog(
    weapons.map((w) => ({
      url_name: w.url_name,
      item_name: w.item_name,
      riven_type: w.riven_type,
      icon: w.icon,
      thumb: w.thumb,
    }))
  );

  const queue = await buildScanQueue();
  const totalWeapons = queue.length;
  const queueCopy: ScanQueueItem[] = [...queue];

  console.log(
    `[Scanner] Starting ${trigger} scan: ${totalWeapons} weapons (from ${weapons.length} WFM riven items), ${workerCount} worker(s), proxies=${!!proxyManager}`
  );

  const [job] = await db
    .insert(scanJobs)
    .values({
      status: "running",
      trigger,
      totalWeapons,
    })
    .returning();

  async function waitUntilRunnable(): Promise<boolean> {
    while (true) {
      const [j] = await db
        .select()
        .from(scanJobs)
        .where(eq(scanJobs.id, job.id))
        .limit(1);
      if (!j) return false;
      if (j.status === "cancelled") return false;
      if (j.status === "running") return true;
      if (j.status === "paused") {
        await new Promise((r) => setTimeout(r, PAUSE_POLL_MS));
        continue;
      }
      return false;
    }
  }

  const MAX_PROXY_RETRIES = 10;
  const RETRY_SLEEP_BASE_MS = 500;

  async function processWeapon(weapon: ScanQueueItem): Promise<number> {
    const maxPrice = parseInt((await getSetting("rank_scan_max_price")) ?? "50", 10) || 50;
    const minEndo = parseInt((await getSetting("rank_scan_min_endo")) ?? "2000", 10) || 2000;

    for (let proxyAttempt = 0; proxyAttempt <= MAX_PROXY_RETRIES; proxyAttempt++) {
      const proxyWithLimiter = proxyManager ? await proxyManager.checkout() : null;
      const limiter = proxyWithLimiter?.limiter ?? getRateLimiter();
      const proxyUrl = proxyWithLimiter?.proxy.url;

      if (proxyUrl) {
        console.log(`[Scanner] Scanning ${weapon.weaponUrlName} via proxy ${proxyWithLimiter!.proxy.id.slice(0, 8)}...`);
      }

      try {
        // No mod_rank or re_rolls filter: pull all listings (single request; no offset to avoid rate limits).
        const auctions = await searchRivenAuctions(weapon.weaponUrlName, {
          limiter,
          proxyUrl,
        });

        let liquidCount = 0;
        const prices: number[] = [];
        const endoPerPlats: number[] = [];

        for (const auction of auctions) {
          if (!auction.buyout_price || auction.buyout_price <= 0) continue;
          if (auction.buyout_price > maxPrice) continue;

          const analysis = analyzeRiven(
            auction.item.mastery_level ?? 8,
            auction.item.mod_rank,
            auction.item.re_rolls ?? 0,
            auction.buyout_price,
            benchmarks
          );

          const isLiquid = analysis.isLiquid && analysis.endoValue >= minEndo;

          prices.push(auction.buyout_price);
          endoPerPlats.push(analysis.endoPerPlat);

          await db
            .insert(rivenSnapshots)
            .values({
              wfmAuctionId: auction.id,
              weaponUrlName: weapon.weaponUrlName,
              weaponName: weapon.weaponName,
              reRolls: auction.item.re_rolls,
              modRank: auction.item.mod_rank,
              buyoutPrice: auction.buyout_price,
              startingPrice: auction.starting_price,
              attributes: auction.item.attributes,
              ownerIgn: auction.owner.ingame_name,
              ownerStatus: auction.owner.status,
              ownerReputation: auction.owner.reputation,
              polarity: auction.item.polarity,
              masteryLevel: auction.item.mastery_level,
              endoValue: analysis.endoValue,
              endoPerPlat: analysis.endoPerPlat,
              isLiquid,
              isDirectSell: auction.is_direct_sell,
              platform: auction.platform,
              scanJobId: job.id,
              rivenName: auction.item.name,
              wfmAuctionUrl: `https://warframe.market/auction/${auction.id}`,
              auctionCreatedAt: auction.created ? new Date(auction.created) : null,
              auctionUpdatedAt: auction.updated ? new Date(auction.updated) : null,
              spottedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: rivenSnapshots.wfmAuctionId,
              set: {
                ownerStatus: auction.owner.status,
                buyoutPrice: auction.buyout_price,
                startingPrice: auction.starting_price,
                endoValue: analysis.endoValue,
                endoPerPlat: analysis.endoPerPlat,
                isLiquid,
                scanJobId: job.id,
                auctionUpdatedAt: auction.updated ? new Date(auction.updated) : null,
                spottedAt: new Date(),
                goneAt: null,
              },
            });

          if (isLiquid) liquidCount++;
        }

        const medianPrice = prices.length > 0 ? median(prices) : null;
        const medianEndoPerPlat =
          endoPerPlats.length > 0 ? median(endoPerPlats) : null;

        await updateWeaponTier(
          weapon.weaponUrlName,
          auctions.length,
          liquidCount,
          medianPrice,
          medianEndoPerPlat
        );

        if (proxyWithLimiter) {
          await proxyManager!.markSuccess(proxyWithLimiter.proxy.id);
          proxyManager!.checkin(proxyWithLimiter.proxy.id);
        }
        return liquidCount;
      } catch (err) {
        if (proxyWithLimiter) {
          await proxyManager!.markFailed(proxyWithLimiter.proxy.id);
        }

        if (isRateLimitError(err) && proxyAttempt < MAX_PROXY_RETRIES) {
          const sleepMs = Math.min(5000, RETRY_SLEEP_BASE_MS * Math.pow(2, proxyAttempt));
          console.warn(
            `[Scanner] Rate limit for ${weapon.weaponUrlName} (${proxyAttempt + 1}/${MAX_PROXY_RETRIES}):`,
            err instanceof Error ? err.message : err,
            "— retrying with new proxy in",
            sleepMs,
            "ms"
          );
          await new Promise((r) => setTimeout(r, sleepMs));
          continue;
        }

        console.error(`[Scanner] Error scanning ${weapon.weaponUrlName}:`, err instanceof Error ? err.message : err);
        return 0;
      }
    }
    return 0;
  }

  async function worker(): Promise<void> {
    while (true) {
      const weapon = queueCopy.shift();
      if (!weapon) break;

      const ok = await waitUntilRunnable();
      if (!ok) break;

      const liquidCount = await processWeapon(weapon);

      await db
        .update(scanJobs)
        .set({
          progress: sql`progress + 1`,
          foundDeals: sql`found_deals + ${liquidCount}`,
        })
        .where(eq(scanJobs.id, job.id));
    }
  }

  try {
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    const [final] = await db
      .select()
      .from(scanJobs)
      .where(eq(scanJobs.id, job.id))
      .limit(1);

    if (final?.status === "running" || final?.status === "paused") {
      await db
        .update(scanJobs)
        .set({
          status: "completed",
          progress: totalWeapons,
          completedAt: new Date(),
        })
        .where(eq(scanJobs.id, job.id));
      console.log(
        `[Scanner] Scan complete. Found ${final?.foundDeals ?? 0} liquid deals across ${totalWeapons} weapons.`
      );
    }
  } catch (error) {
    console.error("[Scanner] Scan failed:", error);
    await db
      .update(scanJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(scanJobs.id, job.id));
  }

  return job.id;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
