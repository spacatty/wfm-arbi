import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watchedAuctions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * DELETE /api/watch?id=...
 * Remove an auction from the watchlist by watched_auctions id (uuid).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Missing id" },
        { status: 400 }
      );
    }
    const deleted = await db
      .delete(watchedAuctions)
      .where(eq(watchedAuctions.id, id))
      .returning({ id: watchedAuctions.id });
    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Watched auction not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Watch] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to remove from watchlist" },
      { status: 500 }
    );
  }
}
