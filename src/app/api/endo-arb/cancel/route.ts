import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { endoArbJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getActiveEndoArbScan } from "@/worker/endo-arb-scanner";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const active = await getActiveEndoArbScan();
  if (!active) {
    return NextResponse.json(
      { error: "No active endo arb scan to cancel" },
      { status: 404 }
    );
  }

  await db
    .update(endoArbJobs)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(eq(endoArbJobs.id, active.id));

  return NextResponse.json({ success: true, jobId: active.id });
}
