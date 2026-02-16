import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { investmentSnapshots, investmentJobs } from "@/lib/db/schema";

/**
 * DELETE /api/investment/purge
 * Remove all investment snapshots and job history. Next scan starts fresh.
 * Admin-only.
 */
export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const deletedSnapshots = await db
      .delete(investmentSnapshots)
      .returning({ id: investmentSnapshots.id });
    const deletedJobs = await db
      .delete(investmentJobs)
      .returning({ id: investmentJobs.id });

    return NextResponse.json({
      deletedSnapshots: deletedSnapshots.length,
      deletedJobs: deletedJobs.length,
    });
  } catch (error) {
    console.error("[Investment Purge] Error:", error);
    return NextResponse.json(
      { error: "Failed to purge investment data" },
      { status: 500 }
    );
  }
}
