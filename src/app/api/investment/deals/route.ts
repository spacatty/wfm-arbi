import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { investmentSnapshots, trackedDeals } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { getBenchmarksFromDB } from "@/lib/db/settings";
import { getBenchmarkRates } from "@/lib/endo";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const offset = Number(searchParams.get("offset")) || 0;

    const snapshots = await db
      .select()
      .from(investmentSnapshots)
      .orderBy(desc(investmentSnapshots.createdAt))
      .limit(limit)
      .offset(offset);

    const benchmarks = await getBenchmarksFromDB();
    const { liquidityThreshold } = getBenchmarkRates(benchmarks);

    const allTracked = await db.select().from(trackedDeals);
    const totalInvested = allTracked.reduce((s, d) => s + d.buyPrice, 0);
    const totalEndo = allTracked.reduce((s, d) => s + d.endoValue, 0);
    const portfolioEndoPerPlat = totalInvested > 0 ? totalEndo / totalInvested : 0;

    return NextResponse.json({
      deals: snapshots,
      liquidityThreshold,
      portfolioEndoPerPlat,
    });
  } catch (error) {
    console.error("Investment deals API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch investment deals" },
      { status: 500 }
    );
  }
}
