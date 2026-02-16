"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Zap,
  Pause,
  Play,
  Square,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ScanStatus {
  id?: string;
  status: string;
  progress?: number;
  totalWeapons?: number;
  foundDeals?: number;
  etaSec?: number | null;
  elapsedSec?: number;
  errorMessage?: string | null;
  minReRolls?: number;
}

interface ScanControlsProps {
  /** Base API path, e.g. "/api/scan" or "/api/endo-arb" */
  apiBase: string;
  /** Label shown in buttons/toasts */
  label?: string;
}

export function ScanControls({ apiBase, label = "Scan" }: ScanControlsProps) {
  const [scan, setScan] = useState<ScanStatus>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${apiBase}/status`);
        setScan(await res.json());
      } catch {
        /* ignore */
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [apiBase]);

  const act = useCallback(
    async (action: string, msg: string) => {
      setBusy(true);
      try {
        const res = await fetch(`${apiBase}/${action}`, { method: "POST" });
        if (res.ok) toast.success(msg);
        else {
          const d = await res.json();
          toast.error(d.error ?? "Failed");
        }
      } catch {
        toast.error("Failed");
      }
      setBusy(false);
    },
    [apiBase]
  );

  const running = scan.status === "running";
  const paused = scan.status === "paused";
  const completed = scan.status === "completed";
  const failed = scan.status === "failed";
  const idle = !running && !paused;
  const pct =
    scan.totalWeapons && scan.totalWeapons > 0
      ? Math.round(((scan.progress ?? 0) / scan.totalWeapons) * 100)
      : 0;

  return (
    <div className="space-y-2">
      {/* Progress bar when active */}
      {(running || paused) && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span
              className={running ? "text-neon-green" : "text-neon-yellow"}
            >
              {running ? "Scanning" : "Paused"}
            </span>
            <span className="text-muted-foreground">
              {scan.progress}/{scan.totalWeapons} · {pct}%
              {scan.etaSec != null && ` · ETA ${scan.etaSec}s`}
            </span>
          </div>
          <Progress value={pct} className="h-1.5" />
          {scan.foundDeals != null && scan.foundDeals > 0 && (
            <p className="text-[10px] font-mono text-neon-green">
              {scan.foundDeals} deals found
            </p>
          )}
        </div>
      )}

      {/* Completed / failed status */}
      {completed && scan.id && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-neon-green">
          <CheckCircle2 className="size-3.5" />
          Last scan: {scan.foundDeals ?? 0} deals
          {scan.elapsedSec != null && ` in ${scan.elapsedSec}s`}
        </div>
      )}
      {failed && scan.id && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-destructive">
          <XCircle className="size-3.5" />
          Last scan failed{scan.errorMessage && ` — ${scan.errorMessage}`}
        </div>
      )}

      {/* Action buttons — full-size horizontally, only vertical gap reduced */}
      <div className="flex gap-2">
        {idle && (
          <Button
            size="sm"
            className="gap-1.5 glow-cyan"
            onClick={() => act("trigger", `${label} started`)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Zap className="size-3.5" />
            )}
            {label} Now
          </Button>
        )}

        {running && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-neon-yellow/30 text-neon-yellow"
              onClick={() => act("pause", "Paused")}
              disabled={busy}
            >
              <Pause className="size-3.5" /> Pause
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-destructive/30 text-destructive"
              onClick={() => act("cancel", "Stopped")}
              disabled={busy}
            >
              <Square className="size-3.5" /> Stop
            </Button>
          </>
        )}

        {paused && (
          <>
            <Button
              size="sm"
              className="gap-1.5 glow-cyan"
              onClick={() => act("resume", "Resumed")}
              disabled={busy}
            >
              <Play className="size-3.5" /> Resume
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 border-destructive/30 text-destructive"
              onClick={() => act("cancel", "Stopped")}
              disabled={busy}
            >
              <Square className="size-3.5" /> Stop
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
