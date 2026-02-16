import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { investmentJobs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const [job] = await db
      .select()
      .from(investmentJobs)
      .orderBy(desc(investmentJobs.startedAt))
      .limit(1);

    if (!job) {
      return NextResponse.json({ status: "idle", message: "No investment scans yet" });
    }

    const elapsedMs = Date.now() - job.startedAt.getTime();
    const elapsedSec = Math.floor(elapsedMs / 1000);

    let etaSec: number | null = null;
    if (job.status === "running" && job.progress > 0) {
      const msPerItem = elapsedMs / job.progress;
      const remaining = job.totalItems - job.progress;
      etaSec = Math.ceil((remaining * msPerItem) / 1000);
    }

    const failedItems = (job.failedItems ?? []) as string[];
    return NextResponse.json({
      id: job.id,
      status: job.status,
      trigger: job.trigger,
      progress: job.progress,
      totalItems: job.totalItems,
      totalWeapons: job.totalItems, // for ScanControls compatibility
      foundCount: job.foundCount,
      foundDeals: job.foundCount, // for ScanControls compatibility
      elapsedSec,
      etaSec,
      startedAt: job.startedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      errorMessage: job.errorMessage,
      failedItems: failedItems.length > 0 ? failedItems : undefined,
      skippedCount: failedItems.length,
    });
  } catch {
    return NextResponse.json(
      { status: "error", message: "Failed to get investment scan status" },
      { status: 500 }
    );
  }
}
