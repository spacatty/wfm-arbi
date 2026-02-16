"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Trash2, Bell, BellOff, Circle, Settings, RefreshCw, MoreVertical, X } from "lucide-react";
import { toast } from "sonner";
import { WhisperButton } from "./whisper-button";
import { useWhisperTemplate } from "./user-profile-context";

const POLL_INTERVALS = [
  { value: 60, label: "1 min" },
  { value: 120, label: "2 min" },
  { value: 300, label: "5 min" },
  { value: 600, label: "10 min" },
  { value: 3600, label: "1 h" },
];
const CUSTOM_INTERVAL_VALUE = "custom";
const PRESET_VALUES = new Set(POLL_INTERVALS.map((o) => o.value));
function pollIntervalLabel(seconds: number): string {
  const preset = POLL_INTERVALS.find((o) => o.value === seconds);
  if (preset) return preset.label;
  const min = Math.round(seconds / 60);
  return `${min} min`;
}

const NOTIFY_ENABLED_KEY = "watch_notifications_enabled";

function getStoredNotifyEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(NOTIFY_ENABLED_KEY);
  return v !== "false";
}

interface WatchedItem {
  id: string;
  wfmAuctionId: string;
  source: string;
  weaponName: string;
  rivenName: string | null;
  ownerIgn: string;
  lastOwnerStatus: string;
  buyoutPrice: number | null;
  lastBuyoutPrice: number | null;
  lastStartingPrice: number | null;
  wfmAuctionUrl: string | null;
  lastCheckedAt: string | null;
  sellerLastSeenAt: string | null;
  createdAt: string;
  /** Initial (add-time); for comparison with current */
  endoPerPlat: number;
  endoValue: number;
  lastEndoPerPlat: number | null;
  lastEndoValue: number | null;
  reRolls: number;
  masteryLevel: number | null;
  auctionCreatedAt: string | null;
  auctionUpdatedAt: string | null;
}

interface WatchEvent {
  id: string;
  kind: string;
  previousValue: string | null;
  currentValue: string | null;
  createdAt: string;
  weaponName: string;
  rivenName: string | null;
  ownerIgn: string;
}

const IMPORTANT_KINDS = ["owner_online", "owner_offline"];
function isImportantEvent(ev: WatchEvent): boolean {
  return IMPORTANT_KINDS.includes(ev.kind);
}

interface Settings {
  pollIntervalSeconds: number;
  running: boolean;
  lastRunAt: string | null;
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/** Frontend-only: compare numbers after serializing. Use round for integer display (E/P, endo) so 835.2 and 835.8 both show as 835. */
function numbersEqual(
  a: number | string | null | undefined,
  b: number | string | null | undefined,
  round: boolean = false
): boolean {
  const an = a != null && a !== "" ? Number(a) : NaN;
  const bn = b != null && b !== "" ? Number(b) : NaN;
  if (Number.isNaN(an) && Number.isNaN(bn)) return true;
  if (Number.isNaN(an) || Number.isNaN(bn)) return false;
  if (round) return Math.round(an) === Math.round(bn);
  return Math.abs(an - bn) < 1e-9;
}

/** When current differs from initial (by numeric comparison): show "initial → current". Otherwise show single value. Color: price up = red, down = green; endo up = green, down = red. */
function CellWithChange({
  initial,
  current,
  format = (n: number) => String(n),
  variant = "price",
}: {
  initial: number | null;
  current: number | null;
  format?: (n: number) => string;
  variant?: "price" | "endo";
}) {
  const initNum = initial != null && initial !== "" ? Number(initial) : null;
  const currNum = current != null && current !== "" ? Number(current) : null;
  const hasCurrent = currNum != null && !Number.isNaN(currNum);
  const useRound = variant === "endo";
  const changed = hasCurrent && !numbersEqual(initial, current, useRound);
  const displayValue =
    initNum != null && !Number.isNaN(initNum)
      ? format(initNum)
      : currNum != null && !Number.isNaN(currNum)
        ? format(currNum)
        : "—";
  if (!changed) return <>{displayValue}</>;
  const isIncrease = currNum! > (initNum ?? 0);
  const isGood = variant === "price" ? !isIncrease : isIncrease;
  const arrowColor = isGood ? "text-neon-green" : "text-destructive";
  return (
    <>
      <span className="text-xs text-muted-foreground">{format(initNum!)}</span>
      <span className={`font-semibold ${arrowColor}`}> → {format(currNum!)}</span>
    </>
  );
}

function fmtEndo(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function lastSeenHours(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const ms = Date.now() - d.getTime();
  if (ms < 0) return "—";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "<1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function eventLabel(ev: WatchEvent): string {
  if (ev.kind === "owner_online") return `${ev.ownerIgn} came online`;
  if (ev.kind === "owner_offline") return `${ev.ownerIgn} went offline`;
  if (ev.kind === "price_change")
    return `Price ${ev.previousValue ?? "?"} → ${ev.currentValue ?? "?"} (${ev.weaponName}${ev.rivenName ? ` ${ev.rivenName}` : ""})`;
  if (ev.kind === "removed_404")
    return `Removed due to 404 (${ev.weaponName ?? "?"}${ev.rivenName ? ` ${ev.rivenName}` : ""})`;
  return ev.kind;
}

export function WatchDashboard() {
  const [watched, setWatched] = useState<WatchedItem[]>([]);
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsSince, setEventsSince] = useState<string | null>(null);
  const [notifyPermission, setNotifyPermission] = useState<NotificationPermission>("default");
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => getStoredNotifyEnabled());
  const [purging, setPurging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(5);
  const [pollIntervalIsCustom, setPollIntervalIsCustom] = useState(false);
  const [forceRescanning, setForceRescanning] = useState(false);
  const [eventsTab, setEventsTab] = useState<"important" | "changes">("important");
  const [purgingEvents, setPurgingEvents] = useState(false);
  const whisperTemplate = useWhisperTemplate();

  const notificationsEnabledRef = useRef(notificationsEnabled);
  const notifyPermissionRef = useRef(notifyPermission);
  notificationsEnabledRef.current = notificationsEnabled;
  notifyPermissionRef.current = notifyPermission;

  // Sync browser permission on mount (preserve current state)
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifyPermission(Notification.permission);
    }
  }, []);

  const fetchList = useCallback(async () => {
    try {
      const [listRes, setRes] = await Promise.all([
        fetch("/api/watch"),
        fetch("/api/watch/settings"),
      ]);
      const listData = await listRes.json();
      const setData = await setRes.json();
      if (listData.watched) setWatched(listData.watched);
      if (setData.pollIntervalSeconds != null)
        setSettings({
          pollIntervalSeconds: setData.pollIntervalSeconds,
          running: setData.running ?? false,
          lastRunAt: setData.lastRunAt ?? null,
        });
    } catch {
      toast.error("Failed to load watchlist");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async (since?: string) => {
    try {
      const url = since ? `/api/watch/events?since=${encodeURIComponent(since)}` : "/api/watch/events?limit=50";
      const res = await fetch(url);
      const data = await res.json();
      if (data.events && Array.isArray(data.events)) {
        if (since) {
          setEvents((prev) => {
            const byId = new Map(prev.map((e) => [e.id, e]));
            for (const ev of data.events as WatchEvent[]) {
              if (!byId.has(ev.id)) byId.set(ev.id, ev);
            }
            const merged = Array.from(byId.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            return merged;
          });
          if (data.events.length > 0 && notifyPermissionRef.current === "granted" && notificationsEnabledRef.current) {
            for (const ev of data.events as WatchEvent[]) {
              if (ev.kind === "owner_online" || ev.kind === "owner_offline") {
                new Notification("Watch", { body: eventLabel(ev) });
              }
            }
          }
        } else {
          const deduped = (data.events as WatchEvent[]).filter(
            (e: WatchEvent, i: number, arr: WatchEvent[]) => arr.findIndex((x) => x.id === e.id) === i
          );
          setEvents(deduped);
        }
        if (data.events.length > 0) {
          const latest = data.events[0];
          if (latest?.createdAt) setEventsSince(latest.createdAt);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!settings?.running) return;
    const t = setInterval(() => {
      if (eventsSince) fetchEvents(eventsSince);
      else fetchEvents();
    }, 8000);
    return () => clearInterval(t);
  }, [settings?.running, eventsSince, fetchEvents]);

  const refetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/watch/settings");
      const data = await res.json();
      if (data.pollIntervalSeconds != null)
        setSettings({
          pollIntervalSeconds: data.pollIntervalSeconds,
          running: data.running ?? false,
          lastRunAt: data.lastRunAt ?? null,
        });
    } catch {
      // ignore
    }
  }, []);

  const refetchSettingsAndList = useCallback(async () => {
    await refetchSettings();
    await fetchList();
  }, [refetchSettings, fetchList]);

  // Sync custom mode and minutes when opening settings
  useEffect(() => {
    if (!settingsOpen || !settings) return;
    const isCustom = !PRESET_VALUES.has(settings.pollIntervalSeconds);
    setPollIntervalIsCustom(isCustom);
    if (isCustom)
      setCustomMinutes(Math.max(1, Math.min(1440, Math.round(settings.pollIntervalSeconds / 60))));
  }, [settingsOpen, settings?.pollIntervalSeconds]);

  // Poll settings + list every 5s when running so "Last poll" and "Last seen" update when worker finishes
  useEffect(() => {
    if (!settings?.running) return;
    refetchSettingsAndList();
    const t = setInterval(refetchSettingsAndList, 5_000);
    return () => clearInterval(t);
  }, [settings?.running, refetchSettingsAndList]);

  const updateSettings = useCallback(
    async (updates: { pollIntervalSeconds?: number; running?: boolean; resetLastRun?: boolean }) => {
      try {
        const res = await fetch("/api/watch/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        if (data.pollIntervalSeconds != null)
          setSettings((s) => ({
            ...(s ?? { pollIntervalSeconds: 120, running: false, lastRunAt: null }),
            pollIntervalSeconds: data.pollIntervalSeconds,
            running: data.running ?? false,
            lastRunAt: data.lastRunAt ?? null,
          }));
        if (updates.running !== undefined) toast.success(updates.running ? "Watch polling started" : "Watch polling stopped");
      } catch {
        toast.error("Failed to update settings");
      }
    },
    []
  );

  const forceRescan = useCallback(async () => {
    if (!settings?.running) {
      toast.info("Start polling in Settings first");
      return;
    }
    setForceRescanning(true);
    try {
      await updateSettings({ resetLastRun: true });
      await fetch("/api/watch/trigger", { method: "POST" });
      toast.success("Rescan started. Data will update in a few seconds.");
    } catch {
      toast.error("Rescan failed");
    } finally {
      setForceRescanning(false);
    }
  }, [updateSettings, settings?.running]);

  const removeWatched = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/watch/${id}`, { method: "DELETE" });
      if (res.ok) {
        setWatched((prev) => prev.filter((w) => w.id !== id));
        toast.success("Removed from watchlist");
      } else {
        const d = await res.json();
        toast.error(d.error ?? "Failed");
      }
    } catch {
      toast.error("Failed to remove");
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setNotifyPermission(p);
    if (p === "granted") {
      setNotificationsEnabled(true);
      localStorage.setItem(NOTIFY_ENABLED_KEY, "true");
      toast.success("Notifications enabled");
    } else if (p === "denied") toast.error("Notifications blocked");
  }, []);

  const setNotifyEnabled = useCallback((enabled: boolean) => {
    setNotificationsEnabled(enabled);
    localStorage.setItem(NOTIFY_ENABLED_KEY, enabled ? "true" : "false");
    toast.success(enabled ? "Notifications on" : "Notifications off");
  }, []);

  const deleteEvent = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/watch/events/${eventId}`, { method: "DELETE" });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== eventId));
        toast.success("Event removed");
      }
    } catch {
      toast.error("Failed to remove event");
    }
  }, []);

  const purgeEvents = useCallback(async (kind?: "important" | "changes") => {
    if (!confirm(`Remove ${kind ? (kind === "important" ? "all Important (online/offline)" : "all price/other change") : "all"} events?`))
      return;
    setPurgingEvents(true);
    try {
      const url = kind ? `/api/watch/events/purge?kind=${kind}` : "/api/watch/events/purge";
      const res = await fetch(url, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setEvents((prev) =>
          kind ? prev.filter((e) => (kind === "important" ? !isImportantEvent(e) : isImportantEvent(e))) : []
        );
        toast.success(`Removed ${data.deleted ?? 0} events`);
        if (!kind) setEventsSince(null);
      } else toast.error(data.error ?? "Purge failed");
    } catch {
      toast.error("Purge failed");
    } finally {
      setPurgingEvents(false);
    }
  }, []);

  const handlePurge = useCallback(async () => {
    if (watched.length === 0) return;
    if (!confirm("Remove all watched auctions and their event history? This cannot be undone."))
      return;
    setPurging(true);
    try {
      const res = await fetch("/api/watch/purge", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setWatched([]);
        setEvents([]);
        setEventsSince(null);
        toast.success(`Purged ${data.deleted ?? 0} watched auctions`);
      } else {
        toast.error(data.error ?? "Purge failed");
      }
    } catch {
      toast.error("Purge failed");
    } finally {
      setPurging(false);
    }
  }, [watched.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden w-full max-w-none px-5 py-5 gap-5">
      <header className="shrink-0">
        <h1 className="text-base font-semibold tracking-tight">Watch</h1>
        <p className="text-xs text-muted-foreground">
          Poll watched auctions for player online and price changes
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 flex-1 min-h-0 min-w-0">
        {/* Left: Watched table (larger) — independently scrollable */}
        <section className="rounded-lg border border-border/30 bg-card/40 overflow-hidden flex flex-col min-h-0 min-w-0">
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border/20 bg-muted/20 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Circle
                className={`size-1.5 shrink-0 rounded-full fill-current ${
                  settings?.running ? "text-neon-green" : "text-muted-foreground/60"
                }`}
                title={settings?.running ? "Polling" : "Stopped"}
              />
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground truncate">
                Watched ({watched.length})
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                last poll: {settings?.lastRunAt ? timeAgo(settings.lastRunAt) : "—"}
              </span>
              <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-primary"
                onClick={forceRescan}
                disabled={forceRescanning || !settings?.running || watched.length === 0}
                title="Rescan (next worker tick ~1 min)"
              >
                {forceRescanning ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
              </Button>
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" title="Settings">
                    <Settings className="size-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-sm">Watch settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <span className="text-xs font-mono uppercase text-muted-foreground">Poll</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={pollIntervalIsCustom ? CUSTOM_INTERVAL_VALUE : String(settings?.pollIntervalSeconds ?? 120)}
                          onValueChange={(v) => {
                            if (v === CUSTOM_INTERVAL_VALUE) {
                              setPollIntervalIsCustom(true);
                              setCustomMinutes(Math.max(1, Math.round((settings?.pollIntervalSeconds ?? 120) / 60)));
                            } else {
                              setPollIntervalIsCustom(false);
                              updateSettings({ pollIntervalSeconds: Number(v) });
                            }
                          }}
                        >
                          <SelectTrigger className="w-[100px] h-8 text-xs">
                            <SelectValue>
                              {pollIntervalIsCustom
                                ? `Custom (${customMinutes} min)`
                                : pollIntervalLabel(settings?.pollIntervalSeconds ?? 0)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {POLL_INTERVALS.map((o) => (
                              <SelectItem key={o.value} value={String(o.value)}>
                                {o.label}
                              </SelectItem>
                            ))}
                            <SelectItem value={CUSTOM_INTERVAL_VALUE}>Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        {pollIntervalIsCustom && (
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={1}
                              max={1440}
                              className="h-8 w-16 text-xs font-mono"
                              value={customMinutes}
                              onChange={(e) => setCustomMinutes(Math.max(1, Math.min(1440, Number(e.target.value) || 1)))}
                              onBlur={() => updateSettings({ pollIntervalSeconds: customMinutes * 60 })}
                            />
                            <span className="text-[11px] text-muted-foreground">min</span>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant={settings?.running ? "destructive" : "default"}
                          className="h-8 text-xs"
                          onClick={() => updateSettings({ running: !settings?.running })}
                        >
                          {settings?.running ? "Stop" : "Start"}
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Last poll: {settings?.lastRunAt ? timeAgo(settings.lastRunAt) : "—"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <span className="text-xs font-mono uppercase text-muted-foreground">Notifications</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {notifyPermission === "default" && (
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={requestNotificationPermission}>
                            <Bell className="size-3" /> Enable
                          </Button>
                        )}
                        {notifyPermission === "denied" && (
                          <span className="text-xs text-muted-foreground">Blocked by browser</span>
                        )}
                        {notifyPermission === "granted" && (
                          <Button
                            size="sm"
                            variant={notificationsEnabled ? "secondary" : "outline"}
                            className="h-8 text-xs gap-1"
                            onClick={() => setNotifyEnabled(!notificationsEnabled)}
                          >
                            {notificationsEnabled ? <Bell className="size-3" /> : <BellOff className="size-3" />}
                            {notificationsEnabled ? "On" : "Off"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                disabled={watched.length === 0 || purging}
                onClick={handlePurge}
                title="Purge all watched"
              >
                {purging ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
              </Button>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {watched.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No auctions watched. Add from Rank Value or Reroll Value tables.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/20 h-7">
                    <TableHead className="text-[10px] font-mono h-7 px-2 w-12">SRC</TableHead>
                    <TableHead className="text-[10px] font-mono h-7 px-2">RIVEN</TableHead>
                    <TableHead className="text-[10px] font-mono h-7 px-2 text-right w-12">PRICE</TableHead>
                    <TableHead className="text-[10px] font-mono h-7 px-2 text-right w-14">E/P</TableHead>
                    <TableHead className="text-[10px] font-mono h-7 px-2 text-right w-10">ENDO</TableHead>
                    <TableHead className="text-[10px] font-mono h-7 px-2 text-center w-8">RR</TableHead>
                    <TableHead className="text-[10px] font-mono h-7 px-2 w-12">LISTED</TableHead>
                    <TableHead className="text-[10px] font-mono h-7 px-2 w-12">UPD</TableHead>
                    <TableHead className="text-[10px] font-mono h-7 px-2">SELLER</TableHead>
                    <TableHead className="text-[10px] font-mono h-7 px-2 w-12 text-right">SEEN</TableHead>
                    <TableHead className="text-[10px] font-mono h-7 px-1 w-14" />
                    <TableHead className="text-[10px] font-mono h-7 px-1 w-6" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {watched.map((w) => (
                    <TableRow key={w.id} className="border-border/10 hover:bg-primary/5 h-9">
                      <TableCell className="px-2 py-1 text-xs font-mono text-muted-foreground">
                        {w.source === "reroll_value" ? "Reroll" : "Rank"}
                      </TableCell>
                      <TableCell className="px-2 py-1">
                        <div className="leading-tight">
                          <span className="text-xs font-medium">{w.weaponName}</span>
                          {w.rivenName && (
                            <span className="text-xs text-muted-foreground ml-1.5">{w.rivenName}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-1 text-right font-mono text-sm font-bold text-primary">
                        <CellWithChange
                          initial={w.buyoutPrice ?? w.lastBuyoutPrice}
                          current={w.lastBuyoutPrice}
                          variant="price"
                        />
                      </TableCell>
                      <TableCell className="px-2 py-1 text-right">
                        <span className="font-mono text-sm font-bold">
                          <CellWithChange
                            initial={w.endoPerPlat ?? 0}
                            current={w.lastEndoPerPlat ?? null}
                            format={(n) => String(Math.round(n))}
                            variant="endo"
                          />
                        </span>
                      </TableCell>
                      <TableCell className="px-2 py-1 text-right font-mono text-sm text-muted-foreground">
                        <CellWithChange
                          initial={w.endoValue ?? 0}
                          current={w.lastEndoValue}
                          format={fmtEndo}
                          variant="endo"
                        />
                      </TableCell>
                      <TableCell className="px-2 py-1 text-center font-mono text-xs text-muted-foreground">
                        {w.reRolls ?? 0}
                      </TableCell>
                      <TableCell className="px-2 py-1 text-xs text-muted-foreground font-mono">
                        {timeAgo(w.auctionCreatedAt)}
                      </TableCell>
                      <TableCell className="px-2 py-1 text-xs text-muted-foreground font-mono">
                        {timeAgo(w.auctionUpdatedAt)}
                      </TableCell>
                      <TableCell className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <Circle
                            className={`size-1.5 shrink-0 fill-current ${
                              w.lastOwnerStatus === "online" || w.lastOwnerStatus === "ingame"
                                ? "text-neon-green"
                                : "text-muted-foreground"
                            }`}
                          />
                          <span className="text-xs font-mono truncate max-w-[80px]">{w.ownerIgn}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 py-1 text-right font-mono text-xs text-muted-foreground">
                        {lastSeenHours(w.sellerLastSeenAt)}
                      </TableCell>
                      <TableCell className="px-1 py-1">
                        <WhisperButton
                          ign={w.ownerIgn}
                          rivenName={w.rivenName || "Riven"}
                          price={w.lastBuyoutPrice ?? 0}
                          auctionUrl={w.wfmAuctionUrl}
                          weaponName={w.weaponName}
                          template={whisperTemplate}
                        />
                      </TableCell>
                      <TableCell className="px-1 py-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeWatched(w.id)}
                          title="Remove from watchlist"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        {/* Right: Events list — Important (online/offline) + Changes (price etc) */}
        <section className="rounded-lg border border-border/30 bg-card/40 overflow-hidden flex flex-col min-h-0 min-w-0">
          <div className="px-4 py-2.5 border-b border-border/20 bg-muted/20 shrink-0 flex items-center justify-between gap-2">
            <Tabs value={eventsTab} onValueChange={(v) => setEventsTab(v as "important" | "changes")} className="w-auto">
              <TabsList className="h-8">
                <TabsTrigger value="important" className="text-xs h-7 px-2">Important</TabsTrigger>
                <TabsTrigger value="changes" className="text-xs h-7 px-2">Changes</TabsTrigger>
              </TabsList>
            </Tabs>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="h-7 w-7" disabled={events.length === 0 || purgingEvents}>
                  {purgingEvents ? <Loader2 className="size-3 animate-spin" /> : <MoreVertical className="size-3" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => purgeEvents("important")}>
                  Purge Important
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => purgeEvents("changes")}>
                  Purge Changes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => purgeEvents()} className="text-destructive">
                  Purge all events
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {(() => {
              const filtered =
                eventsTab === "important"
                  ? events.filter(isImportantEvent)
                  : events.filter((e) => !isImportantEvent(e));
              if (filtered.length === 0) {
                return (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {events.length === 0
                      ? "No events yet. Start polling to detect changes."
                      : eventsTab === "important"
                        ? "No online/offline events."
                        : "No price or other change events."}
                  </div>
                );
              }
              return (
                <ul className="divide-y divide-border/20">
                  {filtered.slice(0, 100).map((ev) => (
                    <li key={ev.id} className="px-3 py-2 text-xs flex items-center justify-between gap-2 group">
                      <span className="min-w-0 flex-1">
                        {ev.kind === "owner_online" && (
                          <span className="text-neon-green">{ev.ownerIgn} came online</span>
                        )}
                        {ev.kind === "owner_offline" && (
                          <span className="text-muted-foreground">{ev.ownerIgn} went offline</span>
                        )}
                        {ev.kind === "price_change" && (
                          <span>
                            Price <span className="text-muted-foreground text-[10px]">{ev.previousValue ?? "?"}</span>
                            <span className="text-destructive font-semibold"> → {ev.currentValue ?? "?"}</span>{" "}
                            <span className="text-muted-foreground">
                              ({ev.weaponName}
                              {ev.rivenName ? ` ${ev.rivenName}` : ""})
                            </span>
                          </span>
                        )}
                        {ev.kind === "removed_404" && (
                          <span className="text-muted-foreground">
                            Removed due to 404{" "}
                            <span className="text-foreground">
                              ({ev.weaponName ?? "?"}
                              {ev.rivenName ? ` ${ev.rivenName}` : ""})
                            </span>
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <span className="text-muted-foreground font-mono">{timeAgo(ev.createdAt)}</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteEvent(ev.id)}
                          title="Remove event"
                        >
                          <X className="size-3" />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </section>
      </div>
    </div>
  );
}
