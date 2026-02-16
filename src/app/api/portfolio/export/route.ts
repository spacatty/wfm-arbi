import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackedDeals, trackedIncome } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

const PORTFOLIO_EXPORT_VERSION = 1;

/**
 * GET /api/portfolio/export
 * Export all tracked deals and their income as JSON for backup/import on another instance.
 */
export async function GET() {
  try {
    const deals = await db
      .select()
      .from(trackedDeals)
      .orderBy(desc(trackedDeals.createdAt));

    const allIncome = await db.select().from(trackedIncome);
    const incomeByDeal = new Map<string, { amount: number; note: string | null; createdAt: string }[]>();
    for (const i of allIncome) {
      const list = incomeByDeal.get(i.trackedDealId) ?? [];
      list.push({
        amount: i.amount,
        note: i.note,
        createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : String(i.createdAt),
      });
      incomeByDeal.set(i.trackedDealId, list);
    }

    const dealsExport = deals.map((d) => ({
      source: d.source,
      weaponUrlName: d.weaponUrlName,
      weaponName: d.weaponName,
      rivenName: d.rivenName,
      reRolls: d.reRolls,
      modRank: d.modRank,
      masteryLevel: d.masteryLevel,
      buyPrice: d.buyPrice,
      endoValue: d.endoValue,
      endoPerPlat: d.endoPerPlat,
      attributes: d.attributes,
      polarity: d.polarity,
      sellerIgn: d.sellerIgn,
      wfmAuctionUrl: d.wfmAuctionUrl,
      platform: d.platform,
      status: d.status,
      notes: d.notes,
      createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
      archivedAt: d.archivedAt
        ? d.archivedAt instanceof Date
          ? d.archivedAt.toISOString()
          : String(d.archivedAt)
        : null,
      income: incomeByDeal.get(d.id) ?? [],
    }));

    const payload = {
      version: PORTFOLIO_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      portfolio: { deals: dealsExport },
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[Portfolio export] error:", error);
    return NextResponse.json({ error: "Failed to export portfolio" }, { status: 500 });
  }
}
