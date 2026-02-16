"use client";

import { useEffect, useState, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, PauseCircle } from "lucide-react";

interface ScanStatus {
  id?: string;
  status: string;
  progress?: number;
  totalWeapons?: number;
  foundDeals?: number;
  etaSec?: number | null;
  elapsedSec?: number;
  durationSec?: number;
  errorMessage?: string | null;
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function ScanProgress() {
  const [scan, setScan] = useState<ScanStatus | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/scan/status");
        const data = await res.json();
        setScan(data);

        if (data.status === "running" || data.status === "paused") {
          setVisible(true);
          if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
          }
        } else if (data.status === "completed" || data.status === "failed") {
          setVisible(true);
          if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = setTimeout(() => setVisible(false), 8000);
        } else {
          setVisible(false);
        }
      } catch {
        // ignore
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);

    return () => {
      clearInterval(interval);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, []);

  if (!visible || !scan) return null;

  const percent =
    scan.totalWeapons && scan.totalWeapons > 0
      ? Math.round(((scan.progress ?? 0) / scan.totalWeapons) * 100)
      : 0;

  return (
    <div className="flex items-center gap-2 text-xs font-mono flex-1 min-w-0">
      {scan.status === "running" && (
        <>
          <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
          <Progress value={percent} className="h-1.5 w-24 shrink-0" />
          <span className="text-primary whitespace-nowrap truncate">
            {scan.progress}/{scan.totalWeapons} ({percent}%)
            {scan.etaSec != null && ` · ETA ${scan.etaSec}s`}
            {scan.foundDeals != null && (
              <span className="text-neon-green ml-1">
                {scan.foundDeals} deals
              </span>
            )}
          </span>
        </>
      )}
      {scan.status === "paused" && (
        <>
          <PauseCircle className="size-3.5 text-neon-yellow shrink-0" />
          <span className="text-neon-yellow whitespace-nowrap truncate">
            Paused — {scan.progress}/{scan.totalWeapons}
          </span>
        </>
      )}
      {scan.status === "completed" && (
        <>
          <CheckCircle2 className="size-3.5 text-neon-green shrink-0" />
          <span className="text-neon-green whitespace-nowrap truncate">
            Complete — {scan.foundDeals ?? 0} deals
            {(scan.durationSec != null || scan.elapsedSec != null) &&
              ` (${formatElapsed(scan.durationSec ?? scan.elapsedSec ?? 0)})`}
          </span>
        </>
      )}
      {scan.status === "failed" && (
        <>
          <XCircle className="size-3.5 text-destructive shrink-0" />
          <span className="text-destructive whitespace-nowrap truncate">
            Failed
            {scan.errorMessage && ` — ${scan.errorMessage}`}
          </span>
        </>
      )}
    </div>
  );
}
