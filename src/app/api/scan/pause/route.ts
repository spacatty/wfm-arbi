import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scanJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [job] = await db
    .select()
    .from(scanJobs)
    .where(eq(scanJobs.status, "running"))
    .limit(1);

  if (!job) {
    return NextResponse.json(
      { error: "No running scan to pause" },
      { status: 404 }
    );
  }

  await db
    .update(scanJobs)
    .set({ status: "paused", pausedAt: new Date() })
    .where(eq(scanJobs.id, job.id));

  return NextResponse.json({ success: true, jobId: job.id });
}
