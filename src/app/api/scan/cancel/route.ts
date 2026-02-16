import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scanJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getActiveScan } from "@/worker/scanner";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const active = await getActiveScan();
  if (!active) {
    return NextResponse.json({ error: "No active scan to cancel" }, { status: 404 });
  }

  await db
    .update(scanJobs)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(eq(scanJobs.id, active.id));

  return NextResponse.json({ success: true, jobId: active.id });
}
