import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackedDeals, trackedIncome } from "@/lib/db/schema";

type ImportDeal = {
  source?: string;
  weaponUrlName: string;
  weaponName: string;
  rivenName?: string | null;
  reRolls?: number;
  modRank?: number;
  masteryLevel?: number;
  buyPrice: number;
  endoValue?: number;
  endoPerPlat?: number;
  attributes?: unknown;
  polarity?: string | null;
  sellerIgn?: string | null;
  wfmAuctionUrl?: string | null;
  platform?: string;
  status?: string;
  notes?: string | null;
  createdAt?: string;
  archivedAt?: string | null;
  income?: { amount: number; note?: string | null; createdAt?: string }[];
};

/**
 * POST /api/portfolio/import
 * Import a previously exported portfolio (tracked deals + income). Does not replace existing data; appends.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const portfolio = body.portfolio ?? body;
    const dealsIn: ImportDeal[] = Array.isArray(portfolio.deals) ? portfolio.deals : [];

    if (dealsIn.length === 0) {
      return NextResponse.json({ error: "No deals in payload", imported: 0 });
    }

    let importedDeals = 0;
    let importedIncome = 0;

    for (const d of dealsIn) {
      if (!d.weaponUrlName || !d.weaponName || d.buyPrice == null) continue;

      const dealValues: Record<string, unknown> = {
        source: d.source ?? "rank_value",
        weaponUrlName: d.weaponUrlName,
        weaponName: d.weaponName,
        rivenName: d.rivenName ?? null,
        reRolls: d.reRolls ?? 0,
        modRank: d.modRank ?? 0,
        masteryLevel: d.masteryLevel ?? 8,
        buyPrice: Number(d.buyPrice),
        endoValue: d.endoValue ?? 0,
        endoPerPlat: d.endoPerPlat ?? 0,
        attributes: Array.isArray(d.attributes) ? d.attributes : [],
        polarity: d.polarity ?? null,
        sellerIgn: d.sellerIgn ?? null,
        wfmAuctionUrl: d.wfmAuctionUrl ?? null,
        platform: d.platform ?? "pc",
        status: (d.status === "archived" ? "archived" : "active") as "active" | "archived",
        notes: d.notes ?? null,
        archivedAt: d.archivedAt ? new Date(d.archivedAt) : null,
      };
      if (d.createdAt) dealValues.createdAt = new Date(d.createdAt);

      const [inserted] = await db
        .insert(trackedDeals)
        .values(dealValues as typeof trackedDeals.$inferInsert)
        .returning({ id: trackedDeals.id });

      if (!inserted?.id) continue;
      importedDeals++;

      const incomeList = Array.isArray(d.income) ? d.income : [];
      for (const i of incomeList) {
        if (typeof i.amount !== "number" || i.amount <= 0) continue;
        const incomeValues: Record<string, unknown> = {
          trackedDealId: inserted.id,
          amount: Math.round(i.amount),
          note: i.note ?? null,
        };
        if (i.createdAt) incomeValues.createdAt = new Date(i.createdAt);
        await db.insert(trackedIncome).values(incomeValues as typeof trackedIncome.$inferInsert);
        importedIncome++;
      }
    }

    return NextResponse.json({
      ok: true,
      importedDeals,
      importedIncome,
    });
  } catch (error) {
    console.error("[Portfolio import] error:", error);
    return NextResponse.json({ error: "Failed to import portfolio" }, { status: 500 });
  }
}
