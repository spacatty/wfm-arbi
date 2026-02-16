import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { investmentJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getActiveInvestmentScan } from "@/worker/investment-scanner";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const active = await getActiveInvestmentScan();
  if (!active) {
    return NextResponse.json(
      { error: "No active investment scan to cancel" },
      { status: 404 }
    );
  }

  await db
    .update(investmentJobs)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(eq(investmentJobs.id, active.id));

  return NextResponse.json({ success: true, jobId: active.id });
}
