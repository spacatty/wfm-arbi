import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { endoArbDeals } from "@/lib/db/schema";
import { desc, eq, isNull, and, sql } from "drizzle-orm";
import { getBenchmarksFromDB } from "@/lib/db/settings";
import { getBenchmarkRates } from "@/lib/endo";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const offset = Number(searchParams.get("offset")) || 0;
    const status = searchParams.get("status"); // "online", "offline", or null

    const conditions = [isNull(endoArbDeals.goneAt)];

    if (status === "online") {
      conditions.push(
        sql`${endoArbDeals.ownerStatus} IN ('online', 'ingame')`
      );
    } else if (status === "offline") {
      conditions.push(eq(endoArbDeals.ownerStatus, "offline"));
    }

    const deals = await db
      .select()
      .from(endoArbDeals)
      .where(and(...conditions))
      .orderBy(desc(endoArbDeals.endoPerPlat))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(endoArbDeals)
      .where(and(...conditions));

    // Counts per status for tab badges
    const statusCounts = await db
      .select({
        status: endoArbDeals.ownerStatus,
        count: sql<number>`count(*)`,
      })
      .from(endoArbDeals)
      .where(isNull(endoArbDeals.goneAt))
      .groupBy(endoArbDeals.ownerStatus);

    const onlineCount = statusCounts
      .filter((s) => s.status === "online" || s.status === "ingame")
      .reduce((sum, s) => sum + Number(s.count), 0);
    const offlineCount = Number(
      statusCounts.find((s) => s.status === "offline")?.count ?? 0
    );

    // Compute liquidity threshold from current benchmark settings
    const benchmarks = await getBenchmarksFromDB();
    const { liquidityThreshold } = getBenchmarkRates(benchmarks);

    return NextResponse.json({
      deals,
      total: Number(countResult.count),
      onlineCount,
      offlineCount,
      allCount: onlineCount + offlineCount,
      liquidityThreshold,
    });
  } catch (error) {
    console.error("Endo arb deals API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch endo arb deals" },
      { status: 500 }
    );
  }
}
