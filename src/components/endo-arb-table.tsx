"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { WhisperButton } from "./whisper-button";
import { useWhisperTemplate } from "./user-profile-context";
import { Loader2, Circle, ChevronLeft, ChevronRight, Trash2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrackButton } from "./track-button";
import { WatchButton } from "./watch-button";
import { PlatIcon, EndoIcon } from "./wf-icons";
import { SortableHead, toggleSort, useSorted, type SortState } from "./sortable-head";
import type { EndoArbDeal } from "@/lib/db/schema";

type ArbSortCol = "price" | "endoPerPlat" | "endoValue" | "reRolls" | "mr" | "riven" | "listed";

const PAGE_SIZE = 100;
const REROLL_VALUE_PROFIT_THRESHOLD_KEY = "reroll_value_profit_threshold";

function getStoredProfitThreshold(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const v = localStorage.getItem(key);
    const n = v != null ? Number(v) : 0;
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  } catch {
    return 0;
  }
}

interface DealsResponse {
  deals: EndoArbDeal[];
  total: number;
  onlineCount: number;
  offlineCount: number;
  allCount: number;
  liquidityThreshold: number;
}

/** Format % difference vs benchmark threshold */
function fmtPctDiff(endoPerPlat: number, threshold: number): { text: string; color: string } {
  if (!threshold || !endoPerPlat) return { text: "", color: "" };
  const pct = ((endoPerPlat - threshold) / threshold) * 100;
  const sign = pct >= 0 ? "+" : "";
  return {
    text: `${sign}${Math.round(pct)}%`,
    color: pct >= 0 ? "text-neon-green" : "text-destructive",
  };
}

function dedup(deals: EndoArbDeal[]): EndoArbDeal[] {
  const seen = new Set<string>();
  return deals.filter((d) => {
    if (seen.has(d.wfmAuctionId)) return false;
    seen.add(d.wfmAuctionId);
    return true;
  });
}

function timeAgo(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}

function fmtEndo(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function EndoArbTable() {
  const { data: session } = useSession();
  const [data, setData] = useState<DealsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [tab, setTab] = useState("online");
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<SortState<ArbSortCol>>({ col: "endoPerPlat", dir: "desc" });
  const [profitThreshold, setProfitThreshold] = useState<number>(() =>
    getStoredProfitThreshold(REROLL_VALUE_PROFIT_THRESHOLD_KEY)
  );
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const whisperTemplate = useWhisperTemplate();
  const isAdmin = session?.user?.role === "admin";

  useEffect(() => {
    try {
      localStorage.setItem(REROLL_VALUE_PROFIT_THRESHOLD_KEY, String(profitThreshold));
    } catch {
      /* ignore */
    }
  }, [profitThreshold]);

  // Reset to first page when tab changes
  useEffect(() => {
    setPage(0);
  }, [tab]);

  const fetchWatchedIds = useCallback(async () => {
    try {
      const res = await fetch("/api/watch/ids");
      const json = await res.json();
      if (res.ok && Array.isArray(json.wfmAuctionIds)) {
        setWatchedIds(new Set(json.wfmAuctionIds));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchTrackedIds = useCallback(async () => {
    try {
      const res = await fetch("/api/tracker/ids");
      const json = await res.json();
      if (res.ok && Array.isArray(json.wfmAuctionIds)) {
        setTrackedIds(new Set(json.wfmAuctionIds));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchDeals = useCallback(async () => {
    try {
      const statusParam = tab === "all" ? "" : `&status=${tab}`;
      const offset = page * PAGE_SIZE;
      const res = await fetch(
        `/api/endo-arb/deals?limit=${PAGE_SIZE}&offset=${offset}${statusParam}`
      );
      const json = await res.json();
      setData(json);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  const handlePurge = useCallback(async () => {
    if (
      !confirm(
        "Remove all reroll deals? The next scan will repopulate. This cannot be undone."
      )
    )
      return;
    setPurging(true);
    try {
      const res = await fetch("/api/endo-arb/deals/purge", {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Purged ${json.deleted} deals`);
        setPage(0);
        fetchDeals();
      } else {
        toast.error(json.error ?? "Purge failed");
      }
    } catch {
      toast.error("Purge failed");
    }
    setPurging(false);
  }, [fetchDeals]);

  useEffect(() => {
    fetchDeals();
    const interval = setInterval(fetchDeals, 5000);
    return () => clearInterval(interval);
  }, [fetchDeals]);

  useEffect(() => {
    fetchWatchedIds();
  }, [fetchWatchedIds]);

  useEffect(() => {
    fetchTrackedIds();
    const t = setInterval(fetchTrackedIds, 15000);
    return () => clearInterval(t);
  }, [fetchTrackedIds]);

  const deduped = data?.deals ? dedup(data.deals) : [];
  const threshold = data?.liquidityThreshold ?? 0;
  const filtered =
    profitThreshold <= 0 || !threshold
      ? deduped
      : deduped.filter((d) => {
          const e = d.endoPerPlat ?? 0;
          const pct = ((e - threshold) / threshold) * 100;
          return pct >= profitThreshold;
        });

  const arbAccessor = useCallback(
    (d: EndoArbDeal, col: ArbSortCol): number | string | Date | null => {
      switch (col) {
        case "price": return d.buyoutPrice ?? 0;
        case "endoPerPlat": return d.endoPerPlat ?? 0;
        case "endoValue": return d.endoValue ?? 0;
        case "reRolls": return d.reRolls ?? 0;
        case "mr": return d.masteryLevel ?? 0;
        case "riven": return d.weaponName || d.weaponUrlName;
        case "listed": return d.auctionCreatedAt != null ? (d.auctionCreatedAt instanceof Date ? d.auctionCreatedAt : new Date(d.auctionCreatedAt as unknown as string | number)) : null;
        default: return null;
      }
    },
    []
  );

  const deals = useSorted(filtered, sort, arbAccessor);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showPagination = total > PAGE_SIZE;

  return (
    <Tabs value={tab} onValueChange={setTab} className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
        <TabsList className="h-8">
          <TabsTrigger value="online" className="text-xs h-7 px-3 gap-1.5">
            <Circle className="size-1.5 fill-neon-green text-neon-green" />
            Online {data ? `(${data.onlineCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="offline" className="text-xs h-7 px-3 gap-1.5">
            <Circle className="size-1.5 fill-muted-foreground text-muted-foreground" />
            Offline {data ? `(${data.offlineCount})` : ""}
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs h-7 px-3">
            All {data ? `(${data.allCount})` : ""}
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" title="Table settings">
                <SlidersHorizontal className="size-3.5" />
                Filter
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="end">
              <div className="space-y-2">
                <Label className="text-xs font-mono">Profit threshold %</Label>
                <p className="text-[11px] text-muted-foreground">
                  Show only offers above this % vs benchmark
                </p>
                <Input
                  type="number"
                  min={0}
                  max={500}
                  step={1}
                  className="h-8 font-mono text-sm"
                  value={profitThreshold || ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? 0 : Number(e.target.value);
                    setProfitThreshold(Number.isFinite(v) ? Math.max(0, v) : 0);
                  }}
                  placeholder="0 = all"
                />
              </div>
            </PopoverContent>
          </Popover>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5 text-destructive border-destructive/30"
              onClick={handlePurge}
              disabled={purging}
            >
              <Trash2 className="size-3" />
              Purge
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md border border-border/30 overflow-auto flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : !deals.length ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No reroll deals found. Run a scan to populate.
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="border-border/20 hover:bg-transparent">
                <SortableHead column="riven" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))}>
                  RIVEN
                </SortableHead>
                <SortableHead column="price" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} className="text-right w-16">
                  <PlatIcon className="size-3.5" />PRICE
                </SortableHead>
                <SortableHead column="endoPerPlat" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} className="text-right w-20">
                  <EndoIcon className="size-3.5" />/<PlatIcon className="size-3.5" />
                </SortableHead>
                <SortableHead column="endoValue" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} className="text-right w-20">
                  <EndoIcon className="size-3.5" />ENDO
                </SortableHead>
                <SortableHead column="reRolls" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} className="w-10 text-center">
                  RR
                </SortableHead>
                <SortableHead column="mr" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} className="w-10 text-center">
                  MR
                </SortableHead>
                <SortableHead column="listed" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} className="w-16">
                  LISTED
                </SortableHead>
                <TableHead className="text-xs font-mono h-8 px-2">
                  SELLER
                </TableHead>
                <TableHead className="text-xs font-mono h-8 px-2 w-8" />
                <TableHead className="text-xs font-mono h-8 px-1 w-7" />
                <TableHead className="text-xs font-mono h-8 px-1 w-7" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal) => (
                <TableRow
                  key={deal.wfmAuctionId}
                  className={`border-border/10 hover:bg-primary/5 h-9 ${
                    trackedIds.has(deal.wfmAuctionId)
                      ? "bg-neon-green/5 border-l-2 border-l-neon-green"
                      : watchedIds.has(deal.wfmAuctionId)
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : ""
                  }`}
                >
                  {/* Riven */}
                  <TableCell className="px-2 py-1">
                    <div className="leading-tight">
                      <span className="text-xs font-medium">
                        {deal.weaponName || deal.weaponUrlName}
                      </span>
                      {deal.rivenName && (
                        <span className="text-xs text-muted-foreground ml-1.5">
                          {deal.rivenName}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Price */}
                  <TableCell className="px-2 py-1 text-right font-mono text-sm font-bold text-primary">
                    {deal.buyoutPrice}
                  </TableCell>

                  {/* Endo/Plat */}
                  <TableCell className="px-2 py-1 text-right">
                    <div className="flex flex-col items-end gap-0">
                      <span className="font-mono text-sm font-bold text-neon-green">
                        {Math.round(deal.endoPerPlat)}
                      </span>
                      {data?.liquidityThreshold ? (() => {
                        const d = fmtPctDiff(deal.endoPerPlat, data.liquidityThreshold);
                        return d.text ? (
                          <span className={`font-mono text-xs font-semibold ${d.color}`}>{d.text}</span>
                        ) : null;
                      })() : null}
                    </div>
                  </TableCell>

                  {/* Total endo value */}
                  <TableCell className="px-2 py-1 text-right font-mono text-xs text-muted-foreground">
                    {fmtEndo(deal.endoValue)}
                  </TableCell>

                  {/* Re-rolls */}
                  <TableCell className="px-2 py-1 text-center font-mono text-xs text-neon-yellow">
                    {deal.reRolls}
                  </TableCell>

                  {/* MR */}
                  <TableCell className="px-2 py-1 text-center font-mono text-xs text-muted-foreground">
                    {deal.masteryLevel}
                  </TableCell>

                  {/* Listed */}
                  <TableCell className="px-2 py-1 text-xs text-muted-foreground font-mono">
                    {timeAgo(deal.auctionCreatedAt)}
                  </TableCell>

                  {/* Seller */}
                  <TableCell className="px-2 py-1">
                    <div className="flex items-center gap-1">
                      <Circle
                        className={`size-1.5 shrink-0 fill-current ${
                          deal.ownerStatus === "ingame" ||
                          deal.ownerStatus === "online"
                            ? "text-neon-green"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="text-xs font-mono truncate max-w-[80px]">
                        {deal.ownerIgn}
                      </span>
                    </div>
                  </TableCell>

                  {/* Whisper */}
                  <TableCell className="px-2 py-1">
                    <WhisperButton
                      ign={deal.ownerIgn}
                      rivenName={deal.rivenName || "Riven"}
                      price={deal.buyoutPrice || 0}
                      auctionUrl={deal.wfmAuctionUrl}
                      weaponName={deal.weaponName || deal.weaponUrlName}
                      template={whisperTemplate}
                    />
                  </TableCell>

                  {/* Track */}
                  <TableCell className="px-1 py-1">
                    <TrackButton
                      deal={{
                        source: "reroll_value",
                        weaponUrlName: deal.weaponUrlName,
                        weaponName: deal.weaponName || deal.weaponUrlName,
                        rivenName: deal.rivenName,
                        reRolls: deal.reRolls,
                        modRank: deal.modRank,
                        masteryLevel: deal.masteryLevel,
                        buyPrice: deal.buyoutPrice || 0,
                        endoValue: deal.endoValue,
                        endoPerPlat: deal.endoPerPlat,
                        attributes: deal.attributes,
                        polarity: deal.polarity,
                        sellerIgn: deal.ownerIgn,
                        wfmAuctionUrl: deal.wfmAuctionUrl,
                        platform: deal.platform,
                      }}
                      onAdded={fetchTrackedIds}
                    />
                  </TableCell>
                  {/* Watch */}
                  <TableCell className="px-1 py-1">
                    <WatchButton
                      deal={{
                        wfmAuctionId: deal.wfmAuctionId,
                        source: "reroll_value",
                        weaponUrlName: deal.weaponUrlName,
                        weaponName: deal.weaponName || deal.weaponUrlName,
                        rivenName: deal.rivenName,
                        buyoutPrice: deal.buyoutPrice,
                        startingPrice: deal.startingPrice,
                        ownerIgn: deal.ownerIgn,
                        ownerStatus: deal.ownerStatus,
                        wfmAuctionUrl: deal.wfmAuctionUrl,
                        endoPerPlat: deal.endoPerPlat,
                        endoValue: deal.endoValue,
                        reRolls: deal.reRolls,
                        masteryLevel: deal.masteryLevel,
                        auctionCreatedAt: deal.auctionCreatedAt,
                        auctionUpdatedAt: deal.auctionUpdatedAt,
                      }}
                      isWatched={watchedIds.has(deal.wfmAuctionId)}
                      onAdded={fetchWatchedIds}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-muted-foreground font-mono">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of{" "}
            {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground font-mono min-w-[4rem] text-center">
              Page {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </Tabs>
  );
}
