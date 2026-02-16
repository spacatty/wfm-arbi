"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ExternalLink, Filter, RotateCcw } from "lucide-react";
import { PlatIcon, EndoIcon } from "./wf-icons";
import { SortableHead, toggleSort, useSorted, type SortState } from "./sortable-head";
import type { InvestmentSnapshot } from "@/lib/db/schema";
import { R10_MOD_DISPLAY_NAMES } from "@/data/tradable-r10-mods";

const WFM_ITEM_BASE = "https://warframe.market/items";
const PAGE_SIZE = 100;

/** WFM slug → human-readable name. Uses pre-built map, falls back to title-casing. */
function formatModName(slug: string): string {
  return R10_MOD_DISPLAY_NAMES[slug] ?? slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

type Timeframe = "48h" | "90d";

type InvestmentSortCol =
  | "mod"
  | "buy"
  | "sell"
  | "pnl"
  | "platIncome"
  | "levelPrice"
  | "volume";

interface DealsResponse {
  deals: InvestmentSnapshot[];
  liquidityThreshold: number;
  portfolioEndoPerPlat?: number;
}

function portfolioLevelCost(endoCost: number, portfolioEndoPerPlat: number): number {
  return portfolioEndoPerPlat > 0 ? endoCost / portfolioEndoPerPlat : 0;
}

function portfolioPnl(
  buy: number,
  sell: number,
  levelCost: number
): number | null {
  const cost = buy + levelCost;
  if (cost <= 0) return null;
  return ((sell - cost) / cost) * 100;
}

export function InvestmentTable({
  timeframe,
  onTimeframeChange,
  refreshTrigger = 0,
}: {
  timeframe: Timeframe;
  onTimeframeChange: (t: Timeframe) => void;
  /** Increment to force a refetch (e.g. after purge). */
  refreshTrigger?: number;
}) {
  const [data, setData] = useState<DealsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortState<InvestmentSortCol>>({
    col: "pnl",
    dir: "desc",
  });
  // Frontend-only filters (apply to current timeframe's PNL and volume)
  const [minPnl, setMinPnl] = useState<string>("");
  const [minVolume, setMinVolume] = useState<string>("");

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/investment/deals?limit=${PAGE_SIZE}&offset=0`
      );
      const json = await res.json();
      setData(json);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
    const interval = setInterval(fetchDeals, 10000);
    return () => clearInterval(interval);
  }, [fetchDeals]);

  useEffect(() => {
    if (refreshTrigger > 0) fetchDeals();
  }, [refreshTrigger, fetchDeals]);

  const deals = data?.deals ?? [];
  const liquidityThreshold = data?.liquidityThreshold ?? 0;
  const portfolioEndoPerPlat = data?.portfolioEndoPerPlat ?? 0;
  const usePortfolio = portfolioEndoPerPlat > 0;

  const accessor = useCallback(
    (d: InvestmentSnapshot, col: InvestmentSortCol): number | string | null => {
      const buy = timeframe === "48h" ? d.buyPriceR0_48h : d.buyPriceR0_90d;
      const sell = timeframe === "48h" ? d.sellPriceR10_48h : d.sellPriceR10_90d;
      const plCost = usePortfolio
        ? portfolioLevelCost(d.endoCostR0ToR10, portfolioEndoPerPlat)
        : d.levelPricePlat ?? 0;
      const plPnl =
        buy != null && sell != null
          ? portfolioPnl(buy, sell, plCost)
          : null;

      const platIncome =
        buy != null && sell != null ? sell - buy - plCost : null;

      if (timeframe === "48h") {
        switch (col) {
          case "mod":
            return formatModName(d.itemUrlName);
          case "buy":
            return d.buyPriceR0_48h ?? -Infinity;
          case "sell":
            return d.sellPriceR10_48h ?? -Infinity;
          case "pnl":
            return usePortfolio && plPnl != null ? plPnl : (d.pnlPct_48h ?? -Infinity);
          case "platIncome":
            return platIncome ?? -Infinity;
          case "levelPrice":
            return usePortfolio ? plCost : (d.levelPricePlat ?? -Infinity);
          case "volume":
            return d.volumeR10_48h ?? -Infinity;
          default:
            return null;
        }
      } else {
        switch (col) {
          case "mod":
            return formatModName(d.itemUrlName);
          case "buy":
            return d.buyPriceR0_90d ?? -Infinity;
          case "sell":
            return d.sellPriceR10_90d ?? -Infinity;
          case "pnl":
            return usePortfolio && plPnl != null ? plPnl : (d.pnlPct_90d ?? -Infinity);
          case "platIncome":
            return platIncome ?? -Infinity;
          case "levelPrice":
            return usePortfolio ? plCost : (d.levelPricePlat ?? -Infinity);
          case "volume":
            return d.volumeR10_90d ?? -Infinity;
          default:
            return null;
        }
      }
    },
    [timeframe, usePortfolio, portfolioEndoPerPlat]
  );

  const sorted = useSorted(deals, sort, accessor);

  const minPnlNum = minPnl === "" ? null : Number(minPnl);
  const minVolumeNum = minVolume === "" ? null : Number(minVolume);
  const hasPnlFilter = minPnlNum !== null && !Number.isNaN(minPnlNum);
  const hasVolumeFilter = minVolumeNum !== null && !Number.isNaN(minVolumeNum);

  const filtered = sorted.filter((d) => {
    const pnlVal = accessor(d, "pnl");
    const volVal = accessor(d, "volume");
    const pnl = typeof pnlVal === "number" && Number.isFinite(pnlVal) ? pnlVal : null;
    const vol = typeof volVal === "number" && Number.isFinite(volVal) ? volVal : null;
    if (hasPnlFilter && minPnlNum != null && (pnl === null || pnl < minPnlNum)) return false;
    if (hasVolumeFilter && minVolumeNum != null && (vol === null || vol < minVolumeNum)) return false;
    return true;
  });

  const handleResetFilters = useCallback(() => {
    setMinPnl("");
    setMinVolume("");
  }, []);

  const hasAnyFilter = hasPnlFilter || hasVolumeFilter;

  return (
    <div className="h-full flex flex-col min-h-0 space-y-2">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <Tabs value={timeframe} onValueChange={(v) => onTimeframeChange(v as Timeframe)}>
          <TabsList className="h-8">
            <TabsTrigger value="48h" className="text-xs h-7 px-3">
              48 hours
            </TabsTrigger>
            <TabsTrigger value="90d" className="text-xs h-7 px-3">
              90 days
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                aria-label="Filters"
              >
                <Filter className="size-3.5" />
                Filters
                {hasAnyFilter && (
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="min-pnl" className="text-xs">
                    Min PNL % ({timeframe})
                  </Label>
                  <Input
                    id="min-pnl"
                    type="number"
                    placeholder="e.g. 10"
                    value={minPnl}
                    onChange={(e) => setMinPnl(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="min-volume" className="text-xs">
                    Min volume ({timeframe})
                  </Label>
                  <Input
                    id="min-volume"
                    type="number"
                    placeholder="e.g. 5"
                    min={0}
                    value={minVolume}
                    onChange={(e) => setMinVolume(e.target.value)}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full text-xs gap-1.5"
                  onClick={handleResetFilters}
                  disabled={!hasAnyFilter}
                >
                  <RotateCcw className="size-3.5" />
                  Reset filters
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          {hasAnyFilter && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1.5 text-muted-foreground"
              onClick={handleResetFilters}
              aria-label="Reset filters"
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border/30 overflow-auto flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !sorted.length ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No investment data. Run a scan to populate.
          </div>
        ) : !filtered.length ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No rows match the current filters. Adjust or reset filters.
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="border-border/20 hover:bg-transparent">
                <SortableHead
                  column="mod"
                  sort={sort}
                  onSort={(c) => setSort(toggleSort(sort, c))}
                >
                  MOD
                </SortableHead>
                <SortableHead
                  column="buy"
                  sort={sort}
                  onSort={(c) => setSort(toggleSort(sort, c))}
                  className="text-center w-16"
                >
                  <PlatIcon className="size-3.5" /> BUY
                </SortableHead>
                <SortableHead
                  column="sell"
                  sort={sort}
                  onSort={(c) => setSort(toggleSort(sort, c))}
                  className="text-center w-16"
                >
                  <PlatIcon className="size-3.5" /> SELL
                </SortableHead>
                <SortableHead
                  column="platIncome"
                  sort={sort}
                  onSort={(c) => setSort(toggleSort(sort, c))}
                  className="text-center w-24"
                >
                  <PlatIcon className="size-3.5" /> INCOME
                </SortableHead>
                <SortableHead
                  column="pnl"
                  sort={sort}
                  onSort={(c) => setSort(toggleSort(sort, c))}
                  className="text-center w-28"
                >
                  PNL%
                </SortableHead>
                <SortableHead
                  column="levelPrice"
                  sort={sort}
                  onSort={(c) => setSort(toggleSort(sort, c))}
                  className="text-center w-32"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help">LEVEL COST</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px]">
                      Platinum cost of endo to level r0→r10. Left: portfolio
                      E/P, right: benchmark. Below: endo amount.
                    </TooltipContent>
                  </Tooltip>
                </SortableHead>
                <SortableHead
                  column="volume"
                  sort={sort}
                  onSort={(c) => setSort(toggleSort(sort, c))}
                  className="text-center w-14"
                >
                  VOL
                </SortableHead>
                <TableHead className="text-center text-xs font-mono h-8 px-2 w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => {
                const buy =
                  timeframe === "48h"
                    ? row.buyPriceR0_48h
                    : row.buyPriceR0_90d;
                const sell =
                  timeframe === "48h"
                    ? row.sellPriceR10_48h
                    : row.sellPriceR10_90d;
                const benchPnl =
                  timeframe === "48h" ? row.pnlPct_48h : row.pnlPct_90d;
                const volume =
                  timeframe === "48h"
                    ? row.volumeR10_48h
                    : row.volumeR10_90d;
                const itemUrl = `${WFM_ITEM_BASE}/${row.itemUrlName}?type=sell`;

                const plLevelCost = usePortfolio
                  ? portfolioLevelCost(row.endoCostR0ToR10, portfolioEndoPerPlat)
                  : row.levelPricePlat;
                const plPnlVal =
                  buy != null && sell != null
                    ? portfolioPnl(buy, sell, plLevelCost)
                    : null;
                const displayPnl = usePortfolio ? plPnlVal : benchPnl;
                const displayLevelCost = plLevelCost;
                const platIncomeVal =
                  buy != null && sell != null
                    ? sell - buy - plLevelCost
                    : null;
                const benchPlatIncomeVal =
                  buy != null && sell != null
                    ? sell - buy - row.levelPricePlat
                    : null;

                return (
                  <TableRow
                    key={row.id}
                    className="border-border/10 hover:bg-primary/5 h-9"
                  >
                    <TableCell className="px-2 py-1 text-xs font-medium">
                      {formatModName(row.itemUrlName)}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-center font-mono text-sm text-neon-green">
                      {buy != null ? buy : "—"}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-center font-mono text-sm text-destructive">
                      {sell != null ? sell : "—"}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-center">
                      <span className="inline-flex flex-col items-center gap-0">
                        <span
                          className={
                            platIncomeVal != null && platIncomeVal >= 0
                              ? "font-mono text-sm font-bold text-neon-green"
                              : "font-mono text-sm text-muted-foreground"
                          }
                        >
                          {platIncomeVal != null ? Math.round(platIncomeVal) : "—"}
                        </span>
                        {usePortfolio && benchPlatIncomeVal != null && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            ({Math.round(benchPlatIncomeVal)})
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-1 text-center">
                      <span className="inline-flex flex-col items-center gap-0">
                        <span
                          className={
                            displayPnl != null && displayPnl >= 0
                              ? "font-mono text-sm font-bold text-neon-green"
                              : "font-mono text-sm text-muted-foreground"
                          }
                        >
                          {displayPnl != null ? `${displayPnl.toFixed(1)}%` : "—"}
                        </span>
                        {usePortfolio && benchPnl != null && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            ({benchPnl.toFixed(1)}% bench)
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-1 text-center">
                      <span className="inline-flex flex-col items-center gap-0 font-mono text-xs">
                        <span className="inline-flex items-center gap-1">
                          {displayLevelCost.toFixed(0)}{" "}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help inline-flex">
                                <EndoIcon className="size-3 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {row.endoCostR0ToR10.toLocaleString()} endo
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        <span className="text-muted-foreground">
                          ({row.levelPricePlat.toFixed(0)})
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="px-2 py-1 text-center font-mono text-xs text-muted-foreground">
                      {volume != null ? volume : "—"}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-center">
                      <a
                        href={itemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center size-7 rounded border border-border/30 hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
                        title="Open on warframe.market"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
