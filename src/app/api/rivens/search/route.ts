import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rivenSnapshots, weaponScanLog } from "@/lib/db/schema";
import { eq, and, gte, lte, isNull, desc, asc, sql } from "drizzle-orm";
import { searchRivenAuctions } from "@/lib/wfm/client";
import { analyzeRiven } from "@/lib/endo";
import { getBenchmarksFromDB } from "@/lib/db/settings";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const weapon = searchParams.get("weapon");
    const positiveStats = searchParams.get("positive_stats"); // comma-separated
    const negativeStats = searchParams.get("negative_stats"); // comma-separated
    const polarity = searchParams.get("polarity");
    const masteryRankMin = searchParams.get("mastery_rank_min");
    const masteryRankMax = searchParams.get("mastery_rank_max");
    const reRollsMin = searchParams.get("re_rolls_min");
    const reRollsMax = searchParams.get("re_rolls_max");
    const maxPrice = searchParams.get("max_price");
    const sortBy = searchParams.get("sort_by") || "price_asc";
    const buyoutPolicy = searchParams.get("buyout_policy") || "direct";
    const status = searchParams.get("status");

    if (!weapon) {
      return NextResponse.json(
        { error: "weapon parameter required" },
        { status: 400 }
      );
    }

    // Check cache freshness (5 min)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [scanLog] = await db
      .select()
      .from(weaponScanLog)
      .where(eq(weaponScanLog.weaponUrlName, weapon))
      .limit(1);

    const cacheIsFresh =
      scanLog?.lastScannedAt && scanLog.lastScannedAt > fiveMinAgo;

    // Only fetch live if cache is stale AND we have advanced filters
    // (or always for a simple weapon search)
    const hasAdvancedFilters = positiveStats || negativeStats || polarity;

    if (!cacheIsFresh || hasAdvancedFilters) {
      const benchmarks = await getBenchmarksFromDB();

      // Build filter options for WFM API
      const auctions = await searchRivenAuctions(weapon, {
        sortBy,
        buyoutPolicy,
        positiveStats: positiveStats
          ? positiveStats.split(",").filter(Boolean)
          : undefined,
        negativeStats: negativeStats
          ? negativeStats.split(",").filter(Boolean)
          : undefined,
        polarity: polarity || undefined,
        masteryRankMin: masteryRankMin ? Number(masteryRankMin) : undefined,
        masteryRankMax: masteryRankMax ? Number(masteryRankMax) : undefined,
        reRollsMin: reRollsMin ? Number(reRollsMin) : undefined,
        reRollsMax: reRollsMax ? Number(reRollsMax) : undefined,
      });

      // Store results in DB
      for (const auction of auctions) {
        if (!auction.buyout_price || auction.buyout_price <= 0) continue;

        const analysis = analyzeRiven(
          auction.item.mastery_level ?? 8,
          auction.item.mod_rank,
          auction.item.re_rolls ?? 0,
          auction.buyout_price,
          benchmarks
        );

        await db
          .insert(rivenSnapshots)
          .values({
            wfmAuctionId: auction.id,
            weaponUrlName: weapon,
            weaponName: scanLog?.weaponName || auction.item.weapon_url_name,
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
            isLiquid: analysis.isLiquid,
            isDirectSell: auction.is_direct_sell,
            platform: auction.platform,
            rivenName: auction.item.name,
            wfmAuctionUrl: `https://warframe.market/auction/${auction.id}`,
            spottedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: rivenSnapshots.wfmAuctionId,
            set: {
              ownerStatus: auction.owner.status,
              buyoutPrice: auction.buyout_price,
              startingPrice: auction.starting_price,
              attributes: auction.item.attributes,
              endoValue: analysis.endoValue,
              endoPerPlat: analysis.endoPerPlat,
              isLiquid: analysis.isLiquid,
              spottedAt: new Date(),
              goneAt: null,
            },
          });
      }

      // Auto-discover: if weapon not in weapon_scan_log, add it
      if (!scanLog) {
        await db
          .insert(weaponScanLog)
          .values({
            weaponUrlName: weapon,
            weaponName: weapon.replace(/_/g, " "),
            tier: "warm",
          })
          .onConflictDoNothing();
      }
    }

    // Query results from DB
    const conditions = [
      eq(rivenSnapshots.weaponUrlName, weapon),
      isNull(rivenSnapshots.goneAt),
    ];

    const minRerolls = Number(reRollsMin) || 0;
    if (minRerolls > 0) {
      conditions.push(gte(rivenSnapshots.reRolls, minRerolls));
    }
    const maxRerolls = Number(reRollsMax) || 0;
    if (maxRerolls > 0) {
      conditions.push(lte(rivenSnapshots.reRolls, maxRerolls));
    }
    const priceMax = Number(maxPrice) || 0;
    if (priceMax > 0) {
      conditions.push(sql`${rivenSnapshots.buyoutPrice} <= ${priceMax}`);
    }

    if (status === "online") {
      conditions.push(
        sql`${rivenSnapshots.ownerStatus} IN ('online', 'ingame')`
      );
    } else if (status === "offline") {
      conditions.push(eq(rivenSnapshots.ownerStatus, "offline"));
    }

    const orderCol =
      sortBy === "price_desc"
        ? desc(rivenSnapshots.buyoutPrice)
        : sortBy === "price_asc"
          ? asc(rivenSnapshots.buyoutPrice)
          : desc(rivenSnapshots.endoPerPlat);

    const results = await db
      .select()
      .from(rivenSnapshots)
      .where(and(...conditions))
      .orderBy(orderCol)
      .limit(100);

    return NextResponse.json({
      results,
      cached: cacheIsFresh && !hasAdvancedFilters,
      count: results.length,
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
