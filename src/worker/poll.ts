/**
 * Background polling worker.
 * Runs as a standalone Node.js process via Docker.
 * Uses node-cron to schedule scans based on app_settings.
 */

// SOCKS proxies tunnel raw TCP; Node then does TLS on top.
// Many SOCKS5 proxies use self-signed certs for the tunnel.
// This disables TLS verification so those proxies work.
// Only affects this worker process, not the Next.js server.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import cron, { type ScheduledTask } from "node-cron";
import { runScan } from "./scanner";
import { runWatchPoll } from "./watch-poller";
import { getSetting } from "../lib/db/settings";

let currentTask: ScheduledTask | null = null;
let watchTask: ScheduledTask | null = null;

async function getIntervalMinutes(): Promise<number> {
  try {
    const val = await getSetting("scan_interval_minutes");
    return val ? Number(val) : Number(process.env.DEFAULT_SCAN_INTERVAL_MINUTES) || 60;
  } catch {
    return Number(process.env.DEFAULT_SCAN_INTERVAL_MINUTES) || 60;
  }
}

async function isAutoScanEnabled(): Promise<boolean> {
  try {
    const val = await getSetting("auto_scan_enabled");
    return val !== "false";
  } catch {
    return true;
  }
}

async function scheduleScan() {
  const raw = await getIntervalMinutes();
  const intervalMinutes = Math.max(1, Math.min(1440, raw)); // 1 min to 24h
  const cronExpression = `*/${intervalMinutes} * * * *`;

  if (currentTask) {
    currentTask.stop();
  }

  console.log(`[Worker] Scheduling auto-scan every ${intervalMinutes} minutes`);

  currentTask = cron.schedule(cronExpression, async () => {
    const enabled = await isAutoScanEnabled();
    if (!enabled) {
      console.log("[Worker] Auto-scan disabled, skipping...");
      return;
    }

    console.log("[Worker] Running scheduled scan...");
    try {
      await runScan("auto");
    } catch (err) {
      console.error("[Worker] Scheduled scan failed:", err);
    }

    // Re-check interval in case admin changed it
    const newInterval = await getIntervalMinutes();
    if (newInterval !== intervalMinutes) {
      console.log(`[Worker] Interval changed to ${newInterval}min, rescheduling...`);
      scheduleScan();
    }
  });
}

async function main() {
  console.log("[Worker] Starting Warframe Market riven scanner worker...");

  // Wait for DB to be ready before reading settings or scheduling
  await new Promise((r) => setTimeout(r, 5000));

  // Schedule recurring scans first so the timer is always set (even if initial run fails)
  await scheduleScan();

  // Run one auto scan in background so "last scan" is fresh after restart (don't block on it)
  const enabled = await isAutoScanEnabled();
  if (enabled) {
    console.log("[Worker] Running initial scan (background)...");
    runScan("auto").catch((err) => console.error("[Worker] Initial scan failed:", err));
  }

  // Watch poll: every minute check if watch is running and interval elapsed, then poll
  watchTask = cron.schedule("* * * * *", async () => {
    try {
      const result = await runWatchPoll();
      if (result.checked > 0) {
        console.log(`[Worker] Watch poll: ${result.checked} checked, ${result.events} events`);
      }
    } catch (err) {
      console.error("[Worker] Watch poll failed:", err);
    }
  });
  console.log("[Worker] Watch poll scheduled (every minute check)");

  // Run one poll immediately on startup if watch is running (so restart picks up current state)
  try {
    const result = await runWatchPoll({ onStartup: true });
    if (result.checked > 0) {
      console.log(`[Worker] Watch poll (startup): ${result.checked} checked, ${result.events} events`);
    }
  } catch (err) {
    console.error("[Worker] Watch poll startup failed:", err);
  }
}

main().catch(console.error);
