/**
 * Investment Scanner — R10 mod buy/level/sell arbitrage
 *
 * Fetches WFM item statistics for popular r10 mods, computes buy (r0) vs sell (r10)
 * prices for 48h and 90d, level cost (endo→plat), and PNL%.
 * Reuses proxy pool and rate limiter like endo-arb scanner.
 */

import { db } from "../lib/db";
import { investmentJobs, investmentSnapshots } from "../lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { getItemStatistics, isRateLimitError } from "../lib/wfm/client";
import { getRateLimiter } from "../lib/wfm/rate-limiter";
import { getBenchmarksFromDB } from "../lib/db/settings";
import { getBenchmarkRates } from "../lib/endo";
import { getEndoCostForMaxRank } from "../lib/endo-level";
import { ProxyManager, loadAliveProxies } from "../lib/proxy-manager";
import { getSetting } from "../lib/db/settings";
import type { InvestmentJob } from "../lib/db/schema";
import type { WfmStatisticsClosedEntry } from "../lib/wfm/types";
import { TRADABLE_R10_MOD_SLUGS } from "../data/tradable-r10-mods";

const PAUSE_POLL_MS = 2000;

function pickPriceForPeriod(
  entries: WfmStatisticsClosedEntry[],
  modRank: number,
  kind: "buy" | "sell"
): { price: number; volume: number } | null {
  const byRank = entries.filter((e) => e.mod_rank === modRank);
  if (byRank.length === 0) return null;
  const last = byRank[byRank.length - 1];
  const price = kind === "buy" ? last.min_price : last.wa_price;
  const totalVolume = byRank.reduce((sum, e) => sum + (e.volume ?? 0), 0);
  return { price, volume: totalVolume };
}

export async function getActiveInvestmentScan(): Promise<InvestmentJob | null> {
  const [job] = await db
    .select()
    .from(investmentJobs)
    .where(sql`${investmentJobs.status} IN ('running', 'paused')`)
    .orderBy(desc(investmentJobs.startedAt))
    .limit(1);
  return job ?? null;
}

export async function runInvestmentScan(
  trigger: "manual" | "auto" = "manual"
): Promise<string> {
  const active = await getActiveInvestmentScan();
  if (active) {
    console.log("[Investment] Scan already active, skipping...");
    return active.id;
  }

  const benchmarks = await getBenchmarksFromDB();
  const { liquidityThreshold } = getBenchmarkRates(benchmarks);
  const useProxies = (await getSetting("use_proxies")) === "true";

  let modList: string[] = [...TRADABLE_R10_MOD_SLUGS];
  try {
    const raw = await getSetting("investment_mod_list");
    if (raw) {
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) modList = parsed;
    }
  } catch {
    // use default
  }

  let proxyManager: ProxyManager | null = null;
  if (useProxies) {
    const alive = await loadAliveProxies();
    proxyManager = new ProxyManager(alive);
    if (proxyManager.count === 0) proxyManager = null;
  }

  const totalItems = modList.length;
  const failedItems: string[] = [];

  console.log(
    `[Investment] Starting ${trigger} scan: ${totalItems} items, proxies=${!!proxyManager}`
  );

  const [job] = await db
    .insert(investmentJobs)
    .values({
      status: "running",
      trigger,
      totalItems,
    })
    .returning();

  const MAX_PROXY_RETRIES = 10;
  const RETRY_SLEEP_BASE_MS = 500;

  // ── Pause / cancel support ──
  async function waitUntilRunnable(): Promise<boolean> {
    while (true) {
      const [j] = await db
        .select()
        .from(investmentJobs)
        .where(eq(investmentJobs.id, job.id))
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

  for (let i = 0; i < modList.length; i++) {
    const ok = await waitUntilRunnable();
    if (!ok) break;

    const itemUrlName = modList[i];

    for (let proxyAttempt = 0; proxyAttempt <= MAX_PROXY_RETRIES; proxyAttempt++) {
      const proxyWithLimiter = proxyManager ? await proxyManager.checkout() : null;
      const limiter = proxyWithLimiter?.limiter ?? getRateLimiter();
      const proxyUrl = proxyWithLimiter?.proxy.url;

      try {
        const payload = await getItemStatistics(itemUrlName, { limiter, proxyUrl });

        const closed = payload.statistics_closed;
        if (!closed?.["48hours"] || !closed?.["90days"]) {
          failedItems.push(itemUrlName);
          if (proxyWithLimiter) proxyManager!.checkin(proxyWithLimiter.proxy.id);
          break;
        }

        const entries48 = closed["48hours"];
        const entries90 = closed["90days"];

        const buy48 = pickPriceForPeriod(entries48, 0, "buy");
        const sell48 = pickPriceForPeriod(entries48, 10, "sell");
        const buy90 = pickPriceForPeriod(entries90, 0, "buy");
        const sell90 = pickPriceForPeriod(entries90, 10, "sell");

        if (!buy48 || !sell48 || !buy90 || !sell90) {
          failedItems.push(itemUrlName);
          if (proxyWithLimiter) proxyManager!.checkin(proxyWithLimiter.proxy.id);
          break;
        }

        const endoCost = getEndoCostForMaxRank(itemUrlName);
        const levelPricePlat =
          liquidityThreshold > 0 ? endoCost / liquidityThreshold : 0;

        function pnl(
          buyPrice: number,
          sellPrice: number,
          levelPlat: number
        ): number | null {
          const cost = buyPrice + levelPlat;
          if (cost <= 0) return null;
          return ((sellPrice - cost) / cost) * 100;
        }

        const buy48r = Math.round(buy48.price);
        const sell48r = Math.round(sell48.price);
        const buy90r = Math.round(buy90.price);
        const sell90r = Math.round(sell90.price);
        const pnlPct48 = pnl(buy48r, sell48r, levelPricePlat);
        const pnlPct90 = pnl(buy90r, sell90r, levelPricePlat);

        // Upsert by item: keep latest per item_url_name (delete previous then insert)
        await db
          .delete(investmentSnapshots)
          .where(eq(investmentSnapshots.itemUrlName, itemUrlName));
        await db.insert(investmentSnapshots).values({
          investmentJobId: job.id,
          itemUrlName,
          endoCostR0ToR10: endoCost,
          levelPricePlat,
          buyPriceR0_48h: buy48r,
          sellPriceR10_48h: sell48r,
          pnlPct_48h: pnlPct48,
          volumeR10_48h: Math.round(sell48.volume),
          buyPriceR0_90d: buy90r,
          sellPriceR10_90d: sell90r,
          pnlPct_90d: pnlPct90,
          volumeR10_90d: Math.round(sell90.volume),
        });

        const [updated] = await db
          .select({ foundCount: investmentJobs.foundCount })
          .from(investmentJobs)
          .where(eq(investmentJobs.id, job.id))
          .limit(1);
        await db
          .update(investmentJobs)
          .set({
            progress: i + 1,
            foundCount: (updated?.foundCount ?? 0) + 1,
          })
          .where(eq(investmentJobs.id, job.id));

        if (proxyWithLimiter) {
          await proxyManager!.markSuccess(proxyWithLimiter.proxy.id);
          proxyManager!.checkin(proxyWithLimiter.proxy.id);
        }
        break;
      } catch (err) {
        if (proxyWithLimiter) {
          await proxyManager!.markFailed(proxyWithLimiter.proxy.id);
        }
        if (isRateLimitError(err) && proxyAttempt < MAX_PROXY_RETRIES) {
          const sleepMs = Math.min(5000, RETRY_SLEEP_BASE_MS * Math.pow(2, proxyAttempt));
          console.warn(
            `[Investment] Rate limit for ${itemUrlName} (${proxyAttempt + 1}/${MAX_PROXY_RETRIES}):`,
            err instanceof Error ? err.message : err,
            "— retrying in",
            sleepMs,
            "ms"
          );
          await new Promise((r) => setTimeout(r, sleepMs));
          continue;
        }
        console.warn(`[Investment] Skip ${itemUrlName}:`, err instanceof Error ? err.message : err);
        failedItems.push(itemUrlName);
        break;
      }
    }
  }

  const [final] = await db
    .select()
    .from(investmentJobs)
    .where(eq(investmentJobs.id, job.id))
    .limit(1);

  if (final?.status === "running" || final?.status === "paused") {
    await db
      .update(investmentJobs)
      .set({
        status: "completed",
        progress: totalItems,
        completedAt: new Date(),
        failedItems: failedItems.length > 0 ? failedItems : null,
      })
      .where(eq(investmentJobs.id, job.id));
    console.log(
      `[Investment] Scan complete. ${final?.foundCount ?? 0} items, ${failedItems.length} skipped.`
    );
  } else {
    // cancelled — just persist failed items
    if (failedItems.length > 0) {
      await db
        .update(investmentJobs)
        .set({ failedItems })
        .where(eq(investmentJobs.id, job.id));
    }
    console.log(`[Investment] Scan ${final?.status ?? "unknown"}.`);
  }

  return job.id;
}
