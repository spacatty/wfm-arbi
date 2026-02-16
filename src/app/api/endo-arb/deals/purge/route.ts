import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { endoArbDeals } from "@/lib/db/schema";

/**
 * DELETE /api/endo-arb/deals/purge
 * Remove all reroll arb deals so the next scan starts fresh.
 * Watch list (watched_auctions) is independent and is not affected.
 * Admin-only.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const deleted = await db
      .delete(endoArbDeals)
      .returning({ id: endoArbDeals.id });

    return NextResponse.json({ deleted: deleted.length });
  } catch (error) {
    console.error("[EndoArb Purge] Error:", error);
    return NextResponse.json(
      { error: "Failed to purge endo arb deals" },
      { status: 500 }
    );
  }
}
