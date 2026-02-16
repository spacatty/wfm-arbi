/**
 * Endo Arbitrage Scanner — Reroll-aware
 *
 * Searches for high-reroll rivens across all weapons.
 * Uses the real dissolution formula to find deals where
 * endo/plat exceeds the benchmark (Ayatan/Antivirus) rate.
 *
 * Reuses the same proxy pool, rate limiter, and WFM client
 * as the main riven scanner.
 */

import { db } from "../lib/db";
import { endoArbJobs, endoArbDeals } from "../lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { searchRivenAuctions, getRivenItems, isRateLimitError } from "../lib/wfm/client";
import { getRateLimiter } from "../lib/wfm/rate-limiter";
import { analyzeRivenArb, DEFAULT_MIN_RE_ROLLS, MIN_BUYOUT_PRICE, REROLL_BANDS } from "../lib/endo-arb";
import { getBenchmarksFromDB, getSetting } from "../lib/db/settings";
import { buildScanQueue, seedWeaponScanLog } from "./queue";
import { ProxyManager, loadAliveProxies } from "../lib/proxy-manager";
import type { EndoArbJob } from "../lib/db/schema";
import type { ScanQueueItem } from "./queue";

const PAUSE_POLL_MS = 2000;

/**
 * Check if there's already an active endo arb scan.
 */
export async function getActiveEndoArbScan(): Promise<EndoArbJob | null> {
  const [job] = await db
    .select()
    .from(endoArbJobs)
    .where(sql`${endoArbJobs.status} IN ('running', 'paused')`)
    .orderBy(desc(endoArbJobs.startedAt))
    .limit(1);
  return job ?? null;
}

/**
 * Run a full endo arb scan cycle.
 * Searches each weapon with re_rolls_min filter and calculates
 * endo value using the real dissolution formula.
 */
export async function runEndoArbScan(
  trigger: "manual" | "auto" = "auto"
): Promise<string> {
  const active = await getActiveEndoArbScan();
  if (active) {
    console.log("[EndoArb] Scan already active, skipping...");
    return active.id;
  }

  const benchmarks = await getBenchmarksFromDB();
  const useProxies = (await getSetting("use_proxies")) === "true";
  const minReRolls = parseInt(
    (await getSetting("endo_arb_min_rerolls")) || String(DEFAULT_MIN_RE_ROLLS),
    10
  ) || DEFAULT_MIN_RE_ROLLS;
  let workerCount = Math.min(
    15,
    Math.max(1, parseInt((await getSetting("worker_count")) || "5", 10) || 5)
  );

  let proxyManager: ProxyManager | null = null;
  if (useProxies) {
    const alive = await loadAliveProxies();
    proxyManager = new ProxyManager(alive);
    if (proxyManager.count === 0) {
      console.log("[EndoArb] No alive proxies; falling back to 1 worker.");
      workerCount = 1;
      proxyManager = null;
    } else {
      workerCount = Math.min(workerCount, Math.max(1, proxyManager.count));
    }
  } else {
    workerCount = 1;
  }

  // Reroll Value: use full WFM riven/items list (maximum guns across all Warframe market data)
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
    `[EndoArb] Starting ${trigger} scan: ${totalWeapons} weapons (from ${weapons.length} WFM riven items), ${workerCount} worker(s), ` +
      `minReRolls=${minReRolls}, proxies=${!!proxyManager}`
  );

  const [job] = await db
    .insert(endoArbJobs)
    .values({
      status: "running",
      trigger,
      totalWeapons,
      minReRolls,
    })
    .returning();

  // ── Pause / cancel support ──
  async function waitUntilRunnable(): Promise<boolean> {
    while (true) {
      const [j] = await db
        .select()
        .from(endoArbJobs)
        .where(eq(endoArbJobs.id, job.id))
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

  // Build reroll bands based on minReRolls setting
  const bands = REROLL_BANDS.filter((b) => (b.max ?? Infinity) >= minReRolls).map(
    (b) => ({ min: Math.max(b.min, minReRolls), max: b.max })
  );
  console.log(
    `[EndoArb] Using ${bands.length} reroll band(s): ${bands
      .map((b) => (b.max ? `${b.min}-${b.max}` : `${b.min}+`))
      .join(", ")}`
  );

  // ── Fetch a single band for a weapon ──
  async function fetchBand(
    weapon: ScanQueueItem,
    bandMin: number,
    bandMax: number | undefined
  ): Promise<{ auctions: number; deals: number }> {
    for (let proxyAttempt = 0; proxyAttempt <= MAX_PROXY_RETRIES; proxyAttempt++) {
      const proxyWithLimiter = proxyManager ? await proxyManager.checkout() : null;
      const limiter = proxyWithLimiter?.limiter ?? getRateLimiter();
      const proxyUrl = proxyWithLimiter?.proxy.url;

      try {
        // Single request per band (no offset to avoid rate limits); r0 + all ranks included.
        const auctions = await searchRivenAuctions(weapon.weaponUrlName, {
          reRollsMin: bandMin,
          reRollsMax: bandMax,
          sortBy: "price_asc",
          buyoutPolicy: "direct",
          limiter,
          proxyUrl,
        });

        let dealCount = 0;

        for (const auction of auctions) {
          if (!auction.buyout_price || auction.buyout_price < MIN_BUYOUT_PRICE) continue;

          const analysis = analyzeRivenArb(
            auction.item.mastery_level,
            auction.item.mod_rank,
            auction.item.re_rolls,
            auction.buyout_price,
            benchmarks
          );

          if (!analysis.isProfitable) continue;

          await db
            .insert(endoArbDeals)
            .values({
              wfmAuctionId: auction.id,
              weaponUrlName: weapon.weaponUrlName,
              weaponName: weapon.weaponName,
              reRolls: auction.item.re_rolls,
              modRank: auction.item.mod_rank,
              masteryLevel: auction.item.mastery_level,
              buyoutPrice: auction.buyout_price,
              startingPrice: auction.starting_price,
              attributes: auction.item.attributes,
              ownerIgn: auction.owner.ingame_name,
              ownerStatus: auction.owner.status,
              ownerReputation: auction.owner.reputation,
              polarity: auction.item.polarity,
              endoValue: analysis.endoValue,
              endoPerPlat: analysis.endoPerPlat,
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
              target: endoArbDeals.wfmAuctionId,
              set: {
                ownerStatus: auction.owner.status,
                buyoutPrice: auction.buyout_price,
                startingPrice: auction.starting_price,
                endoValue: analysis.endoValue,
                endoPerPlat: analysis.endoPerPlat,
                scanJobId: job.id,
                auctionUpdatedAt: auction.updated ? new Date(auction.updated) : null,
                spottedAt: new Date(),
                goneAt: null,
              },
            });

          dealCount++;
        }

        if (proxyWithLimiter) {
          await proxyManager!.markSuccess(proxyWithLimiter.proxy.id);
          proxyManager!.checkin(proxyWithLimiter.proxy.id);
        }
        return { auctions: auctions.length, deals: dealCount };
      } catch (err) {
        if (proxyWithLimiter) {
          await proxyManager!.markFailed(proxyWithLimiter.proxy.id);
        }

        if (isRateLimitError(err) && proxyAttempt < MAX_PROXY_RETRIES) {
          const sleepMs = Math.min(5000, RETRY_SLEEP_BASE_MS * Math.pow(2, proxyAttempt));
          console.warn(
            `[EndoArb] Rate limit for ${weapon.weaponUrlName} band ${bandMin}-${bandMax ?? "∞"} (${proxyAttempt + 1}/${MAX_PROXY_RETRIES}):`,
            err instanceof Error ? err.message : err,
            "— retrying in",
            sleepMs,
            "ms"
          );
          await new Promise((r) => setTimeout(r, sleepMs));
          continue;
        }

        console.error(
          `[EndoArb] Error scanning ${weapon.weaponUrlName} band ${bandMin}-${bandMax ?? "∞"}:`,
          err instanceof Error ? err.message : err
        );
        return { auctions: 0, deals: 0 };
      }
    }
    return { auctions: 0, deals: 0 };
  }

  // ── Per-weapon processing: scan all reroll bands ──
  async function processWeapon(weapon: ScanQueueItem): Promise<number> {
    let totalDeals = 0;
    let totalAuctions = 0;

    for (const band of bands) {
      const result = await fetchBand(weapon, band.min, band.max);
      totalAuctions += result.auctions;
      totalDeals += result.deals;
    }

    if (totalAuctions > 0) {
      console.log(
        `[EndoArb] ${weapon.weaponUrlName}: ${totalAuctions} auctions across ${bands.length} band(s), ${totalDeals} profitable deal(s)`
      );
    }

    return totalDeals;
  }

  // ── Worker loop ──
  async function worker(): Promise<void> {
    while (true) {
      const weapon = queueCopy.shift();
      if (!weapon) break;

      const ok = await waitUntilRunnable();
      if (!ok) break;

      const dealCount = await processWeapon(weapon);

      await db
        .update(endoArbJobs)
        .set({
          progress: sql`progress + 1`,
          foundDeals: sql`found_deals + ${dealCount}`,
        })
        .where(eq(endoArbJobs.id, job.id));
    }
  }

  try {
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);

    const [final] = await db
      .select()
      .from(endoArbJobs)
      .where(eq(endoArbJobs.id, job.id))
      .limit(1);

    if (final?.status === "running" || final?.status === "paused") {
      await db
        .update(endoArbJobs)
        .set({
          status: "completed",
          progress: totalWeapons,
          completedAt: new Date(),
        })
        .where(eq(endoArbJobs.id, job.id));
      console.log(
        `[EndoArb] Scan complete. Found ${final?.foundDeals ?? 0} reroll deals across ${totalWeapons} weapons.`
      );
    }
  } catch (error) {
    console.error("[EndoArb] Scan failed:", error);
    await db
      .update(endoArbJobs)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(endoArbJobs.id, job.id));
  }

  return job.id;
}
