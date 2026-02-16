import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watchEvents, watchedAuctions } from "@/lib/db/schema";
import { desc, eq, gt, sql } from "drizzle-orm";

/**
 * GET /api/watch/events?since=...
 * Poll for new watch events. since = ISO timestamp; returns events created after that time.
 * Uses leftJoin so events for removed auctions (e.g. removed_404) still return with event.weaponName/ownerIgn/rivenName.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sinceParam = searchParams.get("since");
    const limit = Math.min(Number(searchParams.get("limit")) || 50, 100);

    const since =
      sinceParam && !Number.isNaN(new Date(sinceParam).getTime())
        ? new Date(sinceParam)
        : null;

    const base = db
      .select({
        id: watchEvents.id,
        watchedAuctionId: watchEvents.watchedAuctionId,
        kind: watchEvents.kind,
        previousValue: watchEvents.previousValue,
        currentValue: watchEvents.currentValue,
        createdAt: watchEvents.createdAt,
        weaponName: sql<string>`coalesce(${watchedAuctions.weaponName}, ${watchEvents.weaponName})`.as("weapon_name"),
        rivenName: sql<string | null>`coalesce(${watchedAuctions.rivenName}, ${watchEvents.rivenName})`.as("riven_name"),
        ownerIgn: sql<string>`coalesce(${watchedAuctions.ownerIgn}, ${watchEvents.ownerIgn})`.as("owner_ign"),
      })
      .from(watchEvents)
      .leftJoin(
        watchedAuctions,
        eq(watchEvents.watchedAuctionId, watchedAuctions.id)
      );

    const events = since
      ? await base
          .where(gt(watchEvents.createdAt, since))
          .orderBy(desc(watchEvents.createdAt))
          .limit(limit)
      : await base.orderBy(desc(watchEvents.createdAt)).limit(limit);

    return NextResponse.json({ events });
  } catch (error) {
    console.error("[Watch] events GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
