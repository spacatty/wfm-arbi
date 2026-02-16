import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watchedAuctions } from "@/lib/db/schema";

/**
 * GET /api/watch/ids
 * Returns only wfmAuctionIds currently in the watchlist (for highlighting / preventing re-add in deal tables).
 */
export async function GET() {
  try {
    const rows = await db
      .select({ wfmAuctionId: watchedAuctions.wfmAuctionId })
      .from(watchedAuctions);
    const wfmAuctionIds = rows.map((r) => r.wfmAuctionId);
    return NextResponse.json({ wfmAuctionIds });
  } catch (error) {
    console.error("[Watch] GET ids error:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist ids" },
      { status: 500 }
    );
  }
}
