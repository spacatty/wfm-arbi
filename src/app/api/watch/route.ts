import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watchedAuctions } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";

/**
 * GET /api/watch
 * List watched auctions with last state. Recent events are loaded separately via /api/watch/events.
 */
export async function GET() {
  try {
    const list = await db
      .select()
      .from(watchedAuctions)
      .orderBy(desc(watchedAuctions.createdAt));
    return NextResponse.json({ watched: list });
  } catch (error) {
    console.error("[Watch] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/watch
 * Add an auction to the watchlist. All deal fields are copied (no FK); survives arbitrage purge.
 * Body: wfmAuctionId, source, weaponUrlName, weaponName, rivenName?, buyoutPrice?, startingPrice?,
 * ownerIgn, ownerStatus?, wfmAuctionUrl?, endoPerPlat?, endoValue?, reRolls?, masteryLevel?,
 * auctionCreatedAt?, auctionUpdatedAt?
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      wfmAuctionId,
      source,
      weaponUrlName,
      weaponName,
      rivenName,
      buyoutPrice,
      startingPrice,
      ownerIgn,
      ownerStatus = "offline",
      wfmAuctionUrl,
      endoPerPlat = 0,
      endoValue = 0,
      reRolls = 0,
      masteryLevel,
      auctionCreatedAt,
      auctionUpdatedAt,
    } = body;

    if (!wfmAuctionId || !source || !weaponUrlName || !weaponName || !ownerIgn) {
      return NextResponse.json(
        { error: "Missing required fields: wfmAuctionId, source, weaponUrlName, weaponName, ownerIgn" },
        { status: 400 }
      );
    }
    if (source !== "rank_value" && source !== "reroll_value") {
      return NextResponse.json(
        { error: "source must be rank_value or reroll_value" },
        { status: 400 }
      );
    }

    const [inserted] = await db
      .insert(watchedAuctions)
      .values({
        wfmAuctionId,
        source,
        weaponUrlName,
        weaponName,
        rivenName: rivenName ?? null,
        buyoutPrice: buyoutPrice ?? null,
        startingPrice: startingPrice ?? null,
        ownerIgn,
        ownerStatus,
        wfmAuctionUrl: wfmAuctionUrl ?? null,
        endoPerPlat: Number(endoPerPlat) || 0,
        endoValue: Number(endoValue) || 0,
        reRolls: Number(reRolls) || 0,
        masteryLevel: masteryLevel != null ? Number(masteryLevel) : null,
        auctionCreatedAt: auctionCreatedAt ? new Date(auctionCreatedAt) : null,
        auctionUpdatedAt: auctionUpdatedAt ? new Date(auctionUpdatedAt) : null,
        lastOwnerStatus: ownerStatus,
        lastBuyoutPrice: buyoutPrice ?? null,
        lastStartingPrice: startingPrice ?? null,
        lastEndoPerPlat: Number(endoPerPlat) || 0,
        lastEndoValue: Number(endoValue) || 0,
      })
      .onConflictDoNothing({ target: [watchedAuctions.wfmAuctionId] })
      .returning();

    if (!inserted) {
      return NextResponse.json(
        { error: "Already watching this auction", alreadyWatching: true },
        { status: 409 }
      );
    }
    return NextResponse.json({ watched: inserted });
  } catch (error) {
    console.error("[Watch] POST error:", error);
    return NextResponse.json(
      { error: "Failed to add to watchlist" },
      { status: 500 }
    );
  }
}
