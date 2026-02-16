import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllSettings, setSetting } from "@/lib/db/settings";

/** Sensible defaults for settings that may not exist in DB yet */
const SETTINGS_DEFAULTS: Record<string, string> = {
  auto_scan_enabled: "true",
  scan_interval_minutes: "60",
  antivirus_mod_price: "4",
  ayatan_anasa_price: "9",
  use_proxies: "false",
  worker_count: "5",
  rank_scan_max_price: "50",
  rank_scan_min_endo: "2000",
  rank_scan_target_ranks: "6,7,8",
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbSettings = await getAllSettings();
  // Merge defaults with DB values (DB wins)
  const settings = { ...SETTINGS_DEFAULTS, ...dbSettings };
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const body = await request.json();
  const allowedKeys = [
    "auto_scan_enabled",
    "scan_interval_minutes",
    "liquidity_threshold",
    "antivirus_mod_price",
    "ayatan_anasa_price",
    "endo_by_rank",
    "use_proxies",
    "worker_count",
    "rank_scan_max_price",
    "rank_scan_min_endo",
    "rank_scan_target_ranks",
  ];

  for (const [key, value] of Object.entries(body)) {
    if (allowedKeys.includes(key)) {
      await setSetting(key, String(value));
    }
  }

  const settings = await getAllSettings();
  return NextResponse.json({ settings });
}
