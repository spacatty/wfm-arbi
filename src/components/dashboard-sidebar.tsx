"use client";

import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

interface Benchmarks {
  antivirusModPrice: number;
  ayatanAnasaPrice: number;
  liquidityThreshold: number;
}

interface LastScan {
  status: string;
  foundDeals?: number;
  elapsedSec?: number;
}

export function DashboardSidebar() {
  const [benchmarks, setBenchmarks] = useState<Benchmarks | null>(null);
  const [lastScan, setLastScan] = useState<LastScan | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, statusRes] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/scan/status"),
        ]);
        const settings = await settingsRes.json();
        const status = await statusRes.json();

        const av = Number(settings.settings?.antivirus_mod_price) || 4;
        const ay = Number(settings.settings?.ayatan_anasa_price) || 9;

        setBenchmarks({
          antivirusModPrice: av,
          ayatanAnasaPrice: ay,
          liquidityThreshold: Math.round(Math.max(1000 / av, 3450 / ay)),
        });

        if (status.id) {
          setLastScan({
            status: status.status,
            foundDeals: status.foundDeals,
            elapsedSec: status.elapsedSec,
          });
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <Info className="size-3" />
          Benchmarks
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-56 p-3 text-xs font-mono">
        {benchmarks && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">
              Endo Benchmarks
            </p>
            <Row label="Antivirus (1k)" value={`${benchmarks.antivirusModPrice}p`} />
            <Row label="Anasa (3.45k)" value={`${benchmarks.ayatanAnasaPrice}p`} />
            <div className="border-t border-border/30 pt-1.5">
              <Row label="Threshold" value={`${benchmarks.liquidityThreshold} e/p`} accent />
            </div>
          </div>
        )}
        {lastScan && (
          <div className="mt-3 pt-2 border-t border-border/20 space-y-1.5">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">
              Last Scan
            </p>
            <Row label="Status" value={lastScan.status} />
            {lastScan.foundDeals != null && <Row label="Deals" value={String(lastScan.foundDeals)} />}
            {lastScan.elapsedSec != null && <Row label="Duration" value={`${lastScan.elapsedSec}s`} />}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "text-primary font-semibold" : ""}>{value}</span>
    </div>
  );
}
