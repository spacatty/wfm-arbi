import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { investmentJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [job] = await db
    .select()
    .from(investmentJobs)
    .where(eq(investmentJobs.status, "running"))
    .limit(1);

  if (!job) {
    return NextResponse.json(
      { error: "No running investment scan to pause" },
      { status: 404 }
    );
  }

  await db
    .update(investmentJobs)
    .set({ status: "paused", pausedAt: new Date() })
    .where(eq(investmentJobs.id, job.id));

  return NextResponse.json({ success: true, jobId: job.id });
}
