"use client";

import { useEffect, useState } from "react";
import { ScanControls } from "./scan-controls";
import { EndoArbTable } from "./endo-arb-table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Info } from "lucide-react";

interface Stats {
  bestDeal: number;
  totalDeals: number;
  onlineDeals: number;
}

interface Benchmarks {
  antivirusModPrice: number;
  ayatanAnasaPrice: number;
  liquidityThreshold: number;
  minReRolls: number;
}

export function EndoArbDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [bench, setBench] = useState<Benchmarks | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [dealsRes, settingsRes, statusRes] = await Promise.all([
          fetch("/api/endo-arb/deals?limit=1"),
          fetch("/api/settings"),
          fetch("/api/endo-arb/status"),
        ]);
        const dealsData = await dealsRes.json();
        const settingsData = await settingsRes.json();
        const statusData = await statusRes.json();

        const bestDeal = dealsData.deals?.[0]?.endoPerPlat ?? 0;
        const av = Number(settingsData.settings?.antivirus_mod_price) || 4;
        const ay = Number(settingsData.settings?.ayatan_anasa_price) || 9;
        const minRR =
          Number(settingsData.settings?.endo_arb_min_rerolls) || 50;

        setStats({
          bestDeal: Math.round(bestDeal),
          totalDeals: dealsData.allCount ?? 0,
          onlineDeals: dealsData.onlineCount ?? 0,
        });

        setBench({
          antivirusModPrice: av,
          ayatanAnasaPrice: ay,
          liquidityThreshold: Math.round(Math.max(1000 / av, 3450 / ay)),
          minReRolls: statusData.minReRolls ?? minRR,
        });
      } catch {
        /* ignore */
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const statItems = [
    {
      label: "Best E/P",
      value: stats ? `${stats.bestDeal}` : "—",
      accent: "text-neon-green",
    },
    {
      label: "Threshold",
      value: bench ? `${bench.liquidityThreshold}` : "—",
      accent: "text-primary",
    },
    {
      label: "Deals",
      value: stats ? `${stats.totalDeals}` : "—",
      accent: "text-foreground",
    },
    {
      label: "Online",
      value: stats ? `${stats.onlineDeals}` : "—",
      accent: "text-neon-green",
    },
  ];

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden w-full max-w-none px-5 py-5 gap-5">
      {/* Header row: title + Info + ScanControls inline */}
      <div className="shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              Reroll Value
            </h1>
            <p className="text-xs text-muted-foreground">
              High-reroll rivens where dissolution endo exceeds purchase cost
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ScanControls apiBase="/api/endo-arb" label="Scan" />
            <Popover>
              <PopoverTrigger asChild>
                <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="size-3" />
                  Info
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="end"
                className="w-64 p-3 text-xs font-mono"
              >
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider font-semibold">
                    Endo Formula
                  </p>
                  <p className="text-[11px]">
                    endo = 100×(MR-8) + 22.5×2^rank + 200×rerolls
                  </p>
                  {bench && (
                    <>
                      <div className="border-t border-border/30 pt-1.5 mt-1.5">
                        <Row
                          label="Min rerolls"
                          value={String(bench.minReRolls)}
                        />
                        <Row
                          label="Antivirus (1k)"
                          value={`${bench.antivirusModPrice}p`}
                        />
                        <Row
                          label="Anasa (3.45k)"
                          value={`${bench.ayatanAnasaPrice}p`}
                        />
                      </div>
                      <div className="border-t border-border/30 pt-1.5">
                        <Row
                          label="Threshold"
                          value={`${bench.liquidityThreshold} e/p`}
                          accent
                        />
                      </div>
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-4 gap-px rounded-md border border-border/30 bg-border/20 overflow-hidden shrink-0">
          {statItems.map((item) => (
            <div
              key={item.label}
              className="bg-card/60 px-3 py-1.5 flex items-baseline gap-2"
            >
              <span
                className={`text-sm font-bold font-mono tabular-nums ${item.accent}`}
              >
                {item.value}
              </span>
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Deal table fills remaining height and scrolls */}
      <div className="flex-1 min-h-0 flex flex-col min-w-0">
        <EndoArbTable />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "text-primary font-semibold" : ""}>
        {value}
      </span>
    </div>
  );
}
