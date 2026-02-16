import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackedDeals, trackedIncome } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/tracker/:id
 * Update deal status (archive) or notes.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.status === "archived") {
      updates.status = "archived";
      updates.archivedAt = new Date();
    } else if (body.status === "active") {
      updates.status = "active";
      updates.archivedAt = null;
    }
    if (body.notes !== undefined) {
      updates.notes = body.notes;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 });
    }

    const [updated] = await db
      .update(trackedDeals)
      .set(updates)
      .where(eq(trackedDeals.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json({ deal: updated });
  } catch (error) {
    console.error("[Tracker] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update deal" }, { status: 500 });
  }
}

/**
 * DELETE /api/tracker/:id
 * Delete a tracked deal (cascades to income entries).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [deleted] = await db
      .delete(trackedDeals)
      .where(eq(trackedDeals.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[Tracker] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete deal" }, { status: 500 });
  }
}

/**
 * GET /api/tracker/:id
 * Get a single deal with all income entries.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const [deal] = await db
      .select()
      .from(trackedDeals)
      .where(eq(trackedDeals.id, id));

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const income = await db
      .select()
      .from(trackedIncome)
      .where(eq(trackedIncome.trackedDealId, id))
      .orderBy(trackedIncome.createdAt);

    const totalIncome = income.reduce((s, i) => s + i.amount, 0);

    return NextResponse.json({
      deal,
      income,
      totalIncome,
      profit: totalIncome - deal.buyPrice,
    });
  } catch (error) {
    console.error("[Tracker] GET/:id error:", error);
    return NextResponse.json({ error: "Failed to fetch deal" }, { status: 500 });
  }
}
