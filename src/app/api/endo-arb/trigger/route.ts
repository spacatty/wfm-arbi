import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runEndoArbScan, getActiveEndoArbScan } from "@/worker/endo-arb-scanner";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const active = await getActiveEndoArbScan();
  if (active) {
    return NextResponse.json(
      { error: "Endo arb scan already running", jobId: active.id },
      { status: 409 }
    );
  }

  // Run scan in background (don't await)
  const jobPromise = runEndoArbScan("manual");
  jobPromise.catch((err) =>
    console.error("[API] Manual endo arb scan error:", err)
  );

  // Give it a moment to create the job
  await new Promise((r) => setTimeout(r, 500));

  const job = await getActiveEndoArbScan();
  return NextResponse.json({ success: true, jobId: job?.id });
}
