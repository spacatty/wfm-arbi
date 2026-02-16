import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { scanJobs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const [job] = await db
      .select()
      .from(scanJobs)
      .orderBy(desc(scanJobs.startedAt))
      .limit(1);

    if (!job) {
      return NextResponse.json({ status: "idle", message: "No scans yet" });
    }

    const elapsedMs = Date.now() - job.startedAt.getTime();
    const elapsedSec = Math.floor(elapsedMs / 1000);

    let durationSec: number | undefined;
    if (job.status === "completed" && job.completedAt) {
      durationSec = Math.floor((job.completedAt.getTime() - job.startedAt.getTime()) / 1000);
    }

    let etaSec: number | null = null;
    if (job.status === "running" && job.progress > 0) {
      const msPerWeapon = elapsedMs / job.progress;
      const remaining = job.totalWeapons - job.progress;
      etaSec = Math.ceil((remaining * msPerWeapon) / 1000);
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      trigger: job.trigger,
      progress: job.progress,
      totalWeapons: job.totalWeapons,
      foundDeals: job.foundDeals,
      elapsedSec,
      durationSec,
      etaSec,
      startedAt: job.startedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
      errorMessage: job.errorMessage,
    });
  } catch (error) {
    return NextResponse.json({ status: "error", message: "Failed to get scan status" }, { status: 500 });
  }
}
