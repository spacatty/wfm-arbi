import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { modSales } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/mod-sales/:id — edit a sale
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.modName !== undefined) updates.modName = body.modName.trim();
    if (body.buyPrice !== undefined) updates.buyPrice = parseInt(body.buyPrice) || 0;
    if (body.endoUsed !== undefined) updates.endoUsed = parseInt(body.endoUsed) || 0;
    if (body.sellPrice !== undefined) updates.sellPrice = parseInt(body.sellPrice);
    if (body.note !== undefined) updates.note = body.note?.trim() || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(modSales)
      .set(updates)
      .where(eq(modSales.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json({ sale: updated });
  } catch (error) {
    console.error("[ModSales] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update sale" }, { status: 500 });
  }
}

/**
 * DELETE /api/mod-sales/:id
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db
      .delete(modSales)
      .where(eq(modSales.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ModSales] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete sale" }, { status: 500 });
  }
}
