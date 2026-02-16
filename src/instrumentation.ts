/**
 * Runs once when the Next.js server starts. Starts the auto-scan timer and watch poll
 * so they run even when the separate worker process is not running (e.g. dev or single container).
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Defer so we don't block server startup; DB may not be ready immediately
  setTimeout(() => {
    void startScanScheduler();
    // When worker runs (e.g. Docker), only the worker runs the watch poll so the selected interval is respected
    if (process.env.DISABLE_APP_WATCH_POLL !== "true") {
      void startWatchPoller();
    }
  }, 8000);
}

const TICK_MS = 60_000; // check every minute
let lastScheduledRunAt = 0;

async function startScanScheduler() {
  const { getSetting } = await import("@/lib/db/settings");
  const { runScan } = await import("@/worker/scanner");

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

  async function tick() {
    try {
      const enabled = await isAutoScanEnabled();
      if (!enabled) return;

      const intervalMinutes = Math.max(1, await getIntervalMinutes());
      const intervalMs = intervalMinutes * 60 * 1000;
      const now = Date.now();
      if (now - lastScheduledRunAt < intervalMs && lastScheduledRunAt > 0) return;

      lastScheduledRunAt = now;
      console.log("[Scan scheduler] Running scheduled scan...");
      await runScan("auto");
    } catch (err) {
      console.error("[Scan scheduler] Tick failed:", err);
      lastScheduledRunAt = 0; // allow retry next tick
    }
  }

  console.log("[Scan scheduler] Auto-scan timer started (reinitialized on app load)");
  setInterval(tick, TICK_MS);
  // Run one tick after a short delay so first scan happens soon after load
  setTimeout(() => void tick(), 5000);
}

/** Watch poll: run runWatchPoll every 30s so when polling is enabled and interval elapsed, it runs. */
async function startWatchPoller() {
  const { runWatchPoll } = await import("@/worker/watch-poller");
  const WATCH_TICK_MS = 30_000; // check every 30s so 2min interval is hit

  async function tick() {
    try {
      const result = await runWatchPoll();
      if (result.checked > 0) {
        console.log("[Watch scheduler] Poll: %d checked, %d events", result.checked, result.events);
      }
    } catch (err) {
      console.error("[Watch scheduler] Poll failed:", err);
    }
  }

  console.log("[Watch scheduler] Watch poll timer started (reinitialized on app load)");
  setInterval(tick, WATCH_TICK_MS);
  // Run once soon after load so first poll happens if enabled and interval passed
  setTimeout(() => void tick(), 10000);
}
