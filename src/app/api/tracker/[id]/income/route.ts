import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackedIncome } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/tracker/:id/income
 * Add a plat income entry to a tracked deal.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.amount || typeof body.amount !== "number" || body.amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    const [entry] = await db
      .insert(trackedIncome)
      .values({
        trackedDealId: id,
        amount: Math.round(body.amount),
        note: body.note || null,
      })
      .returning();

    return NextResponse.json({ income: entry });
  } catch (error) {
    console.error("[Tracker] POST income error:", error);
    return NextResponse.json(
      { error: "Failed to add income" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tracker/:id/income
 * List all income entries for a tracked deal.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entries = await db
      .select()
      .from(trackedIncome)
      .where(eq(trackedIncome.trackedDealId, id))
      .orderBy(trackedIncome.createdAt);

    const total = entries.reduce((s, e) => s + e.amount, 0);

    return NextResponse.json({ income: entries, total });
  } catch (error) {
    console.error("[Tracker] GET income error:", error);
    return NextResponse.json(
      { error: "Failed to fetch income" },
      { status: 500 }
    );
  }
}
