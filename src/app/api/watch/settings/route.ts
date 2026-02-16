import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { watchSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/watch/settings
 * Get watch poll settings (single row). Creates default row if none exists.
 */
export async function GET() {
  try {
    let [row] = await db.select().from(watchSettings).limit(1);
    if (!row) {
      [row] = await db
        .insert(watchSettings)
        .values({
          pollIntervalSeconds: 120,
          running: false,
        })
        .returning();
    }
    return NextResponse.json({
      pollIntervalSeconds: row.pollIntervalSeconds,
      running: row.running,
      lastRunAt: row.lastRunAt,
      updatedAt: row.updatedAt,
    });
  } catch (error) {
    console.error("[Watch] settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch watch settings" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/watch/settings
 * Update poll interval, running, or force next run. Body: { pollIntervalSeconds?: number, running?: boolean, resetLastRun?: boolean }
 * resetLastRun: set lastRunAt to null so worker runs on next tick. Safe to call while worker is already scanning (idempotent).
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { pollIntervalSeconds, running, resetLastRun } = body;

    let [row] = await db.select().from(watchSettings).limit(1);
    if (!row) {
      [row] = await db
        .insert(watchSettings)
        .values({
          pollIntervalSeconds: 120,
          running: false,
        })
        .returning();
    }

    const updates: { pollIntervalSeconds?: number; running?: boolean; lastRunAt?: null; updatedAt?: Date } = {
      updatedAt: new Date(),
    };
    if (typeof pollIntervalSeconds === "number" && pollIntervalSeconds >= 60) {
      updates.pollIntervalSeconds = pollIntervalSeconds;
    }
    if (typeof running === "boolean") {
      updates.running = running;
      if (running) updates.lastRunAt = null;
    }
    if (resetLastRun === true) {
      updates.lastRunAt = null;
    }

    const [updated] = await db
      .update(watchSettings)
      .set(updates)
      .where(eq(watchSettings.id, row.id))
      .returning();

    return NextResponse.json({
      pollIntervalSeconds: updated.pollIntervalSeconds,
      running: updated.running,
      lastRunAt: updated.lastRunAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error("[Watch] settings PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update watch settings" },
      { status: 500 }
    );
  }
}
