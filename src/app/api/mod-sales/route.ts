import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { modSales } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

/**
 * GET /api/mod-sales — list all mod sales
 */
export async function GET() {
  try {
    const sales = await db
      .select()
      .from(modSales)
      .orderBy(desc(modSales.createdAt));

    return NextResponse.json({ sales });
  } catch (error) {
    console.error("[ModSales] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch mod sales" }, { status: 500 });
  }
}

/**
 * POST /api/mod-sales — add a mod sale { modName, buyPrice, endoUsed, sellPrice, note? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const modName = (body.modName || "").trim();
    const buyPrice = parseInt(body.buyPrice) || 0;
    const endoUsed = parseInt(body.endoUsed) || 0;
    const sellPrice = parseInt(body.sellPrice);

    if (!modName) {
      return NextResponse.json({ error: "Mod name is required" }, { status: 400 });
    }
    if (!sellPrice || sellPrice <= 0) {
      return NextResponse.json({ error: "Sell price must be positive" }, { status: 400 });
    }

    const [sale] = await db
      .insert(modSales)
      .values({
        modName,
        buyPrice,
        endoUsed,
        sellPrice,
        note: body.note?.trim() || null,
      })
      .returning();

    return NextResponse.json({ sale });
  } catch (error) {
    console.error("[ModSales] POST error:", error);
    return NextResponse.json({ error: "Failed to add mod sale" }, { status: 500 });
  }
}
