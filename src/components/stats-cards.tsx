"use client";

import { useEffect, useState } from "react";

interface Stats {
  bestDeal: number;
  liquidityThreshold: number;
  totalDeals: number;
  onlineDeals: number;
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [dealsRes, settingsRes] = await Promise.all([
          fetch("/api/deals?limit=1&liquid=true"),
          fetch("/api/settings"),
        ]);
        const dealsData = await dealsRes.json();
        const settingsData = await settingsRes.json();

        const bestDeal = dealsData.deals?.[0]?.endoPerPlat ?? 0;
        const threshold =
          Number(settingsData.settings?.liquidity_threshold) || 400;

        setStats({
          bestDeal: Math.round(bestDeal),
          liquidityThreshold: threshold,
          totalDeals: dealsData.allCount ?? 0,
          onlineDeals: dealsData.onlineCount ?? 0,
        });
      } catch {
        /* ignore */
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const items = [
    { label: "Best E/P", value: stats ? `${stats.bestDeal}` : "—", accent: "text-neon-green" },
    { label: "Threshold", value: stats ? `${stats.liquidityThreshold}` : "—", accent: "text-primary" },
    { label: "Deals", value: stats ? `${stats.totalDeals}` : "—", accent: "text-foreground" },
    { label: "Online", value: stats ? `${stats.onlineDeals}` : "—", accent: "text-neon-green" },
  ];

  return (
    <div className="grid grid-cols-4 gap-px rounded-md border border-border/30 bg-border/20 overflow-hidden shrink-0">
      {items.map((item) => (
        <div key={item.label} className="bg-card/60 px-3 py-1.5 flex items-baseline gap-2">
          <span className={`text-sm font-bold font-mono tabular-nums ${item.accent}`}>
            {item.value}
          </span>
          <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
