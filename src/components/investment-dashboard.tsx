"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ScanControls } from "./scan-controls";
import { InvestmentTable } from "./investment-table";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Timeframe = "48h" | "90d";

export function InvestmentDashboard() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [timeframe, setTimeframe] = useState<Timeframe>("48h");
  const [skippedCount, setSkippedCount] = useState<number | null>(null);
  const [purgeTrigger, setPurgeTrigger] = useState(0);
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/investment/status");
        const data = await res.json();
        setSkippedCount(
          data.skippedCount != null ? data.skippedCount : null
        );
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  const handlePurge = useCallback(async () => {
    if (
      !confirm(
        "Remove all investment snapshots and job history? The next scan will repopulate. This cannot be undone."
      )
    )
      return;
    setPurging(true);
    try {
      const res = await fetch("/api/investment/purge", { method: "DELETE" });
      const json = await res.json();
      if (res.ok) {
        toast.success(
          `Purged ${json.deletedSnapshots ?? 0} snapshots, ${json.deletedJobs ?? 0} jobs`
        );
        setPurgeTrigger((k) => k + 1);
      } else {
        toast.error(json.error ?? "Purge failed");
      }
    } catch {
      toast.error("Purge failed");
    }
    setPurging(false);
  }, []);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden w-full max-w-none px-5 py-5 gap-5">
      {/* Header row: title + ScanControls + skipped count + Purge */}
      <div className="shrink-0 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight">
            Investment
          </h1>
          <p className="text-xs text-muted-foreground">
            R10 mods: buy (rank 0), level, sell (max rank). PNL% and level cost in plat.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ScanControls apiBase="/api/investment" label="Scan" />
          {skippedCount != null && skippedCount > 0 && (
            <p className="text-xs font-mono text-muted-foreground">
              {skippedCount} item{skippedCount !== 1 ? "s" : ""} skipped (no data / 404)
            </p>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 text-destructive border-destructive/30"
              onClick={handlePurge}
              disabled={purging}
            >
              {purging ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Purge
            </Button>
          )}
        </div>
      </div>

      {/* Table fills remaining height and scrolls */}
      <div className="flex-1 min-h-0 flex flex-col min-w-0">
        <InvestmentTable
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          refreshTrigger={purgeTrigger}
        />
      </div>
    </div>
  );
}
