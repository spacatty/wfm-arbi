import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watchEvents } from "@/lib/db/schema";
import { inArray, eq } from "drizzle-orm";

/**
 * DELETE /api/watch/events/purge
 * Query: kind = "important" | "changes" | omit = all.
 * Purge all events, or only Important (owner_online/owner_offline) or only Changes (price_change etc).
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const kindFilter = searchParams.get("kind"); // "important" | "changes" | null = all

    let result: { id: string }[];
    if (kindFilter === "important") {
      result = await db
        .delete(watchEvents)
        .where(inArray(watchEvents.kind, ["owner_online", "owner_offline"]))
        .returning({ id: watchEvents.id });
    } else if (kindFilter === "changes") {
      result = await db
        .delete(watchEvents)
        .where(eq(watchEvents.kind, "price_change"))
        .returning({ id: watchEvents.id });
    } else {
      result = await db.delete(watchEvents).returning({ id: watchEvents.id });
    }
    return NextResponse.json({ deleted: result.length });
  } catch (error) {
    console.error("[Watch] events purge error:", error);
    return NextResponse.json(
      { error: "Failed to purge events" },
      { status: 500 }
    );
  }
}
