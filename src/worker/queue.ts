import { db } from "../lib/db";
import { weaponScanLog } from "../lib/db/schema";
import { eq, asc, desc, and } from "drizzle-orm";

export interface ScanQueueItem {
  weaponUrlName: string;
  weaponName: string;
  tier: "hot" | "warm" | "cold";
}

/**
 * Build an adaptive scan queue based on weapon tier data.
 * Uses all enabled weapons from weapon_scan_log (populate via POST /api/reference/sync
 * from WFM /riven/items for maximum guns across Warframe market data).
 *
 * HOT: had liquid deals in last scan -> always scanned first
 * WARM: had auctions but no liquid deals -> scanned after hot
 * COLD: 0 results for 3+ scans -> skipped unless 6h since last scan
 */
export async function buildScanQueue(): Promise<ScanQueueItem[]> {
  const weapons = await db
    .select()
    .from(weaponScanLog)
    .where(eq(weaponScanLog.enabled, true))
    .orderBy(
      desc(weaponScanLog.liquidCount),
      asc(weaponScanLog.consecutiveEmpty),
      asc(weaponScanLog.lastScannedAt)
    );

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const queue: ScanQueueItem[] = [];

  for (const w of weapons) {
    if (w.tier === "cold") {
      // Only include cold weapons if >6h since last scan
      if (!w.lastScannedAt || w.lastScannedAt < sixHoursAgo) {
        queue.push({
          weaponUrlName: w.weaponUrlName,
          weaponName: w.weaponName,
          tier: "cold",
        });
      }
      continue;
    }

    queue.push({
      weaponUrlName: w.weaponUrlName,
      weaponName: w.weaponName,
      tier: w.tier as "hot" | "warm",
    });
  }

  return queue;
}

/**
 * Seed the weapon scan log from WFM riven items list.
 * Called on first run to populate all weapons.
 * Also updates icon/thumb/rivenType on conflict.
 */
export async function seedWeaponScanLog(
  weapons: {
    url_name: string;
    item_name: string;
    riven_type?: string;
    icon?: string;
    thumb?: string;
  }[]
): Promise<void> {
  for (const w of weapons) {
    await db
      .insert(weaponScanLog)
      .values({
        weaponUrlName: w.url_name,
        weaponName: w.item_name,
        rivenType: w.riven_type ?? null,
        icon: w.icon ?? null,
        thumb: w.thumb ?? null,
        tier: "warm",
      })
      .onConflictDoUpdate({
        target: weaponScanLog.weaponUrlName,
        set: {
          weaponName: w.item_name,
          rivenType: w.riven_type ?? null,
          icon: w.icon ?? null,
          thumb: w.thumb ?? null,
        },
      });
  }
}

/**
 * Update weapon tier after a scan based on results.
 */
export async function updateWeaponTier(
  weaponUrlName: string,
  auctionCount: number,
  liquidCount: number,
  medianPrice: number | null,
  medianEndoPerPlat: number | null
): Promise<void> {
  const existing = await db
    .select()
    .from(weaponScanLog)
    .where(eq(weaponScanLog.weaponUrlName, weaponUrlName))
    .limit(1);

  let newTier: "hot" | "warm" | "cold";
  let consecutiveEmpty = 0;

  if (liquidCount > 0) {
    newTier = "hot";
    consecutiveEmpty = 0;
  } else if (auctionCount > 0) {
    newTier = "warm";
    consecutiveEmpty = 0;
  } else {
    consecutiveEmpty = (existing[0]?.consecutiveEmpty ?? 0) + 1;
    newTier = consecutiveEmpty >= 3 ? "cold" : "warm";
  }

  await db
    .update(weaponScanLog)
    .set({
      lastScannedAt: new Date(),
      auctionCount,
      liquidCount,
      medianPrice,
      medianEndoPerPlat,
      tier: newTier,
      consecutiveEmpty,
    })
    .where(eq(weaponScanLog.weaponUrlName, weaponUrlName));
}
