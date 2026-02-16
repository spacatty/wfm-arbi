import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackedDeals } from "@/lib/db/schema";
import { isNotNull } from "drizzle-orm";

/**
 * GET /api/tracker/ids
 * Returns wfmAuctionIds of deals currently in the portfolio (tracked_deals).
 * Used to highlight "purchased" rows in Rank Value and Reroll Value tables.
 * IDs are extracted from wfmAuctionUrl (e.g. https://warframe.market/auction/XXX -> XXX).
 */
export async function GET() {
  try {
    const rows = await db
      .select({ wfmAuctionUrl: trackedDeals.wfmAuctionUrl })
      .from(trackedDeals)
      .where(isNotNull(trackedDeals.wfmAuctionUrl));

    const wfmAuctionIds: string[] = [];
    for (const r of rows) {
      const url = r.wfmAuctionUrl?.trim();
      if (!url) continue;
      const match = url.match(/\/auction\/([^/?#]+)/);
      if (match?.[1]) wfmAuctionIds.push(match[1]);
    }

    return NextResponse.json({ wfmAuctionIds });
  } catch (error) {
    console.error("[Tracker] GET ids error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tracker ids" },
      { status: 500 }
    );
  }
}
