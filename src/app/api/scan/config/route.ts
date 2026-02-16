import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/db/settings";

/**
 * PATCH /api/scan/config — update worker_count or use_proxies (for next scan or dynamic behavior).
 * Only applied when scan is not running; mid-scan changes can be supported later.
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { workerCount, useProxies } = body as {
      workerCount?: number;
      useProxies?: boolean;
    };

    if (typeof workerCount === "number") {
      const clamped = Math.min(15, Math.max(1, Math.round(workerCount)));
      await setSetting("worker_count", String(clamped));
    }
    if (typeof useProxies === "boolean") {
      await setSetting("use_proxies", String(useProxies));
    }

    const settings = {
      worker_count: await getSetting("worker_count"),
      use_proxies: await getSetting("use_proxies"),
    };
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error("Scan config PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update config" },
      { status: 500 }
    );
  }
}
