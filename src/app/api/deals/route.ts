import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rivenSnapshots } from "@/lib/db/schema";
import { desc, eq, isNull, and, gte, lte, sql } from "drizzle-orm";
import { getBenchmarksFromDB, getSetting } from "@/lib/db/settings";
import { getBenchmarkRates } from "@/lib/endo";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const offset = Number(searchParams.get("offset")) || 0;
    const status = searchParams.get("status"); // "online", "offline", "all", or "1plat"
    const liquidOnly = searchParams.get("liquid") !== "false"; // default true
    const minPrice = searchParams.get("min_price");
    const maxPrice = searchParams.get("max_price");

    const conditions = [isNull(rivenSnapshots.goneAt)];

    let minEndo = 2000;
    if (liquidOnly) {
      conditions.push(eq(rivenSnapshots.isLiquid, true));
      const minEndoRaw = await getSetting("rank_scan_min_endo");
      minEndo = parseInt(minEndoRaw ?? "2000", 10) || 2000;
      conditions.push(gte(rivenSnapshots.endoValue, minEndo));
    }

    if (status === "online") {
      conditions.push(
        sql`${rivenSnapshots.ownerStatus} IN ('online', 'ingame')`
      );
    } else if (status === "offline") {
      conditions.push(eq(rivenSnapshots.ownerStatus, "offline"));
    }
    // "1plat" tab: only buyout_price = 1 (no status filter)
    if (maxPrice != null) {
      const n = parseInt(maxPrice, 10);
      if (!Number.isNaN(n)) conditions.push(lte(rivenSnapshots.buyoutPrice, n));
    }
    if (minPrice != null) {
      const n = parseInt(minPrice, 10);
      if (!Number.isNaN(n)) conditions.push(gte(rivenSnapshots.buyoutPrice, n));
    }

    const deals = await db
      .select()
      .from(rivenSnapshots)
      .where(and(...conditions))
      .orderBy(desc(rivenSnapshots.endoPerPlat))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rivenSnapshots)
      .where(and(...conditions));

    // Get counts per status for tab badges (main tabs exclude 1p)
    const countConditions = [isNull(rivenSnapshots.goneAt)];
    if (liquidOnly) {
      countConditions.push(eq(rivenSnapshots.isLiquid, true));
      countConditions.push(gte(rivenSnapshots.endoValue, minEndo));
    }
    countConditions.push(gte(rivenSnapshots.buyoutPrice, 2)); // exclude 1p from Online/Offline/All counts
    const statusCounts = await db
      .select({
        status: rivenSnapshots.ownerStatus,
        count: sql<number>`count(*)`,
      })
      .from(rivenSnapshots)
      .where(and(...countConditions))
      .groupBy(rivenSnapshots.ownerStatus);

    const onlineCount =
      statusCounts
        .filter((s) => s.status === "online" || s.status === "ingame")
        .reduce((sum, s) => sum + Number(s.count), 0);
    const offlineCount = Number(
      statusCounts.find((s) => s.status === "offline")?.count ?? 0
    );

    // Count for 1-plat tab (liquid, min endo, price = 1)
    const onePlatConditions = [
      isNull(rivenSnapshots.goneAt),
      eq(rivenSnapshots.isLiquid, true),
      gte(rivenSnapshots.endoValue, minEndo),
      eq(rivenSnapshots.buyoutPrice, 1),
    ];
    const [onePlatRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rivenSnapshots)
      .where(and(...onePlatConditions));
    const onePlatCount = Number(onePlatRow?.count ?? 0);

    // Compute liquidity threshold from current benchmark settings
    const benchmarks = await getBenchmarksFromDB();
    const { liquidityThreshold } = getBenchmarkRates(benchmarks);

    return NextResponse.json({
      deals,
      total: Number(countResult.count),
      onlineCount,
      offlineCount,
      allCount: onlineCount + offlineCount,
      onePlatCount,
      liquidityThreshold,
    });
  } catch (error) {
    console.error("Deals API error:", error);
    return NextResponse.json({ error: "Failed to fetch deals" }, { status: 500 });
  }
}
