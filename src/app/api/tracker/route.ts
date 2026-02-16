import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackedDeals, trackedIncome } from "@/lib/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { getBenchmarksFromDB } from "@/lib/db/settings";
import { getBenchmarkRates } from "@/lib/endo";

/**
 * GET /api/tracker?status=active|archived|all
 * List tracked deals with aggregated income.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";

    const conditions =
      status === "all" ? [] : [eq(trackedDeals.status, status as "active" | "archived")];

    const deals = await db
      .select()
      .from(trackedDeals)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(trackedDeals.createdAt));

    // Get income totals per deal
    const incomeAgg = await db
      .select({
        trackedDealId: trackedIncome.trackedDealId,
        totalIncome: sql<number>`COALESCE(SUM(${trackedIncome.amount}), 0)`,
        incomeCount: sql<number>`COUNT(*)`,
      })
      .from(trackedIncome)
      .groupBy(trackedIncome.trackedDealId);

    const incomeMap = new Map(
      incomeAgg.map((i) => [
        i.trackedDealId,
        { totalIncome: Number(i.totalIncome), incomeCount: Number(i.incomeCount) },
      ])
    );

    const enriched = deals.map((d) => ({
      ...d,
      totalIncome: incomeMap.get(d.id)?.totalIncome ?? 0,
      incomeCount: incomeMap.get(d.id)?.incomeCount ?? 0,
      profit: (incomeMap.get(d.id)?.totalIncome ?? 0) - d.buyPrice,
    }));

    // Summary stats
    const activeDealsList = enriched.filter((d) => d.status === "active");
    const allDeals = enriched;

    const totalInvested = allDeals.reduce((s, d) => s + d.buyPrice, 0);
    const totalIncome = allDeals.reduce((s, d) => s + d.totalIncome, 0);
    const netProfit = totalIncome - totalInvested;
    const activeInvested = activeDealsList.reduce((s, d) => s + d.buyPrice, 0);
    const activeIncome = activeDealsList.reduce((s, d) => s + d.totalIncome, 0);

    // Compute liquidity threshold from current benchmark settings
    const benchmarks = await getBenchmarksFromDB();
    const { liquidityThreshold } = getBenchmarkRates(benchmarks);

    return NextResponse.json({
      deals: enriched,
      stats: {
        totalDeals: allDeals.length,
        activeDeals: activeDealsList.length,
        totalInvested,
        totalIncome,
        netProfit,
        activeInvested,
        activeIncome,
      },
      liquidityThreshold,
    });
  } catch (error) {
    console.error("[Tracker] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch tracker" }, { status: 500 });
  }
}

/**
 * POST /api/tracker
 * Add a deal to the tracker (copies data from request body).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const [deal] = await db
      .insert(trackedDeals)
      .values({
        source: body.source || "rank_value",
        weaponUrlName: body.weaponUrlName,
        weaponName: body.weaponName,
        rivenName: body.rivenName || null,
        reRolls: body.reRolls ?? 0,
        modRank: body.modRank ?? 0,
        masteryLevel: body.masteryLevel ?? 8,
        buyPrice: body.buyPrice,
        endoValue: body.endoValue ?? 0,
        endoPerPlat: body.endoPerPlat ?? 0,
        attributes: body.attributes ?? [],
        polarity: body.polarity || null,
        sellerIgn: body.sellerIgn || null,
        wfmAuctionUrl: body.wfmAuctionUrl || null,
        platform: body.platform || "pc",
        notes: body.notes || null,
      })
      .returning();

    return NextResponse.json({ deal });
  } catch (error) {
    console.error("[Tracker] POST error:", error);
    return NextResponse.json({ error: "Failed to add tracked deal" }, { status: 500 });
  }
}
