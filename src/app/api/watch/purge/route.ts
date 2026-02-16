import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { watchedAuctions } from "@/lib/db/schema";

/**
 * DELETE /api/watch/purge
 * Remove all watched auctions (and their events via cascade).
 * Does not change watch_settings (interval, running).
 * Auth required.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const deleted = await db
      .delete(watchedAuctions)
      .returning({ id: watchedAuctions.id });

    return NextResponse.json({ deleted: deleted.length });
  } catch (error) {
    console.error("[Watch Purge] Error:", error);
    return NextResponse.json(
      { error: "Failed to purge watch list" },
      { status: 500 }
    );
  }
}
