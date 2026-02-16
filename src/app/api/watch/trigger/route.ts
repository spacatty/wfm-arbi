import { NextResponse } from "next/server";
import { runWatchPoll } from "@/worker/watch-poller";

/**
 * POST /api/watch/trigger
 * Run one watch poll in the background (fire-and-forget).
 * Use when the worker is not running (e.g. dev) so Rescan still updates data.
 * Returns immediately; dashboard polling will show new data when the poll finishes.
 */
export async function POST() {
  runWatchPoll({ onStartup: true }).catch((err) => {
    console.error("[Watch] Trigger poll failed:", err);
  });
  return NextResponse.json({ triggered: true });
}
