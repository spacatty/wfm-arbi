import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rivenSnapshots } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * DELETE /api/deals/purge?full=false
 * Remove liquid deals (or all snapshots if full=true) so the next scan starts fresh.
 * Watch list (watched_auctions) is independent and is not affected.
 * Admin-only.
 */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const full = searchParams.get("full") === "true";

    if (full) {
      const deleted = await db
        .delete(rivenSnapshots)
        .returning({ id: rivenSnapshots.id });
      return NextResponse.json({ deleted: deleted.length, full: true });
    }

    const deleted = await db
      .delete(rivenSnapshots)
      .where(eq(rivenSnapshots.isLiquid, true))
      .returning({ id: rivenSnapshots.id });

    return NextResponse.json({ deleted: deleted.length, full: false });
  } catch (error) {
    console.error("[Deals Purge] Error:", error);
    return NextResponse.json(
      { error: "Failed to purge deals" },
      { status: 500 }
    );
  }
}
