import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackedIncome } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * DELETE /api/tracker/:id/income/:incomeId
 * Delete a specific income entry.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; incomeId: string }> }
) {
  try {
    const { incomeId } = await params;
    const [deleted] = await db
      .delete(trackedIncome)
      .where(eq(trackedIncome.id, incomeId))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "Income entry not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[Tracker] DELETE income error:", error);
    return NextResponse.json(
      { error: "Failed to delete income entry" },
      { status: 500 }
    );
  }
}
