import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runInvestmentScan, getActiveInvestmentScan } from "@/worker/investment-scanner";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const active = await getActiveInvestmentScan();
  if (active) {
    return NextResponse.json(
      { error: "Investment scan already running", jobId: active.id },
      { status: 409 }
    );
  }

  runInvestmentScan("manual").catch((err) =>
    console.error("[API] Investment scan error:", err)
  );

  await new Promise((r) => setTimeout(r, 500));
  const job = await getActiveInvestmentScan();
  return NextResponse.json({ success: true, jobId: job?.id });
}
