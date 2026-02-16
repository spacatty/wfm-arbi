import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watchEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * DELETE /api/watch/events/:eventId
 * Delete a single watch event.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;
    if (!eventId) {
      return NextResponse.json({ error: "Missing event id" }, { status: 400 });
    }
    const deleted = await db
      .delete(watchEvents)
      .where(eq(watchEvents.id, eventId))
      .returning({ id: watchEvents.id });
    if (deleted.length === 0) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[Watch] event DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}
