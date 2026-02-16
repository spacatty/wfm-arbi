"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Shield, Zap, XCircle, Save, Globe, Trash2, PlayCircle, Pause, Play, Square, Loader2, RefreshCw, Copy, Check } from "lucide-react";

interface ProxyRow {
  id: string;
  url: string;
  label: string | null;
  isAlive: boolean;
  failCount: number;
  lastUsedAt: string | null;
  lastFailedAt: string | null;
}

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proxiesList, setProxiesList] = useState<ProxyRow[]>([]);
  const [proxyUrls, setProxyUrls] = useState("");
  const [proxyTestingId, setProxyTestingId] = useState<string | null>(null);
  const [checkAllLoading, setCheckAllLoading] = useState(false);
  const [scanStatus, setScanStatus] = useState<string>("idle");
  const [serverIp, setServerIp] = useState<string | null>(null);
  const [ipCopied, setIpCopied] = useState(false);

  const useProxies = settings.use_proxies === "true";

  useEffect(() => {
    if (session?.user?.role !== "admin") return;
    const poll = () => {
      fetch("/api/scan/status")
        .then((r) => r.json())
        .then((d) => setScanStatus(d.status ?? "idle"))
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [session?.user?.role]);

  useEffect(() => {
    if (session && session.user.role !== "admin") {
      router.push("/dashboard");
      return;
    }

    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setSettings(d.settings || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, router]);

  useEffect(() => {
    if (session?.user?.role !== "admin") return;
    fetch("/api/proxies")
      .then((r) => r.json())
      .then((d) => setProxiesList(d.proxies ?? []))
      .catch(() => {});
    fetch("/api/server-ip")
      .then((r) => r.json())
      .then((d) => setServerIp(d.ip ?? null))
      .catch(() => {});
  }, [session?.user?.role]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        toast.success("Settings saved");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    }
    setSaving(false);
  };

  const handleScanNow = async () => {
    try {
      const res = await fetch("/api/scan/trigger", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Scan triggered");
      } else {
        toast.error(data.error || "Failed to trigger scan");
      }
    } catch {
      toast.error("Failed to trigger scan");
    }
  };

  const handlePauseScan = async () => {
    try {
      const res = await fetch("/api/scan/pause", { method: "POST" });
      if (res.ok) {
        toast.success("Scan paused");
        setScanStatus("paused");
      } else {
        const d = await res.json();
        toast.error(d.error ?? "Failed to pause");
      }
    } catch {
      toast.error("Failed to pause");
    }
  };

  const handleResumeScan = async () => {
    try {
      const res = await fetch("/api/scan/resume", { method: "POST" });
      if (res.ok) {
        toast.success("Scan resumed");
        setScanStatus("running");
      } else {
        const d = await res.json();
        toast.error(d.error ?? "Failed to resume");
      }
    } catch {
      toast.error("Failed to resume");
    }
  };

  const handleCancelScan = async () => {
    try {
      const res = await fetch("/api/scan/cancel", { method: "POST" });
      if (res.ok) {
        toast.success("Scan stopped");
        setScanStatus("idle");
      } else {
        const d = await res.json();
        toast.error(d.error ?? "No active scan to cancel");
      }
    } catch {
      toast.error("Failed to cancel scan");
    }
  };

  const handleAddProxies = async () => {
    const lines = proxyUrls.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast.error("Enter at least one proxy URL");
      return;
    }
    try {
      const res = await fetch("/api/proxies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: lines.join("\n") }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Added ${data.added ?? 0} proxies`);
        setProxyUrls("");
        fetch("/api/proxies").then((r) => r.json()).then((d) => setProxiesList(d.proxies ?? []));
      } else {
        toast.error(data.error ?? "Failed to add");
      }
    } catch {
      toast.error("Failed to add proxies");
    }
  };

  const handleRemoveDead = async () => {
    try {
      const res = await fetch("/api/proxies?removeDead=true", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Removed ${data.deleted ?? 0} dead proxies`);
        fetch("/api/proxies").then((r) => r.json()).then((d) => setProxiesList(d.proxies ?? []));
      }
    } catch {
      toast.error("Failed to remove");
    }
  };

  const handleTestProxy = async (id: string) => {
    setProxyTestingId(id);
    try {
      const res = await fetch("/api/proxies/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("Proxy OK");
      } else {
        toast.error(data.error ?? "Proxy test failed");
      }
    } catch {
      toast.error("Proxy test failed");
    } finally {
      setProxyTestingId(null);
    }
  };

  const handleDeleteProxy = async (id: string) => {
    try {
      const res = await fetch(`/api/proxies?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setProxiesList((prev) => prev.filter((p) => p.id !== id));
        toast.success("Proxy removed");
      }
    } catch {
      toast.error("Failed to remove");
    }
  };

  const handleCheckAll = async () => {
    setCheckAllLoading(true);
    try {
      const res = await fetch("/api/proxies/check-all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Checked ${data.checked}: ${data.alive} alive, ${data.deadRemoved} removed`);
        fetch("/api/proxies").then((r) => r.json()).then((d) => setProxiesList(d.proxies ?? []));
      } else {
        toast.error(data.error ?? "Check failed");
      }
    } catch {
      toast.error("Check failed");
    } finally {
      setCheckAllLoading(false);
    }
  };

  const handleRemoveAll = async () => {
    if (!confirm("Remove all proxies? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/proxies?removeAll=true", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Removed ${data.deleted ?? 0} proxies`);
        setProxiesList([]);
      } else {
        toast.error(data.error ?? "Failed to remove");
      }
    } catch {
      toast.error("Failed to remove");
    }
  };

  if (loading) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-neon-purple" />
          Admin Panel
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage scan settings, benchmarks, and application configuration.
        </p>
      </div>

      {/* Scan Controls */}
      <Card className="border-border/30">
        <CardHeader>
          <CardTitle className="text-sm font-mono uppercase tracking-wider">
            Scan Controls
          </CardTitle>
          <CardDescription>
            Trigger manual scans or configure auto-scanning.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-mono text-muted-foreground mr-2">
              Status: {scanStatus}
            </span>
            {scanStatus === "idle" && (
              <Button onClick={handleScanNow} className="gap-2 glow-cyan">
                <Zap className="w-4 h-4" /> Scan Now
              </Button>
            )}
            {scanStatus === "running" && (
              <>
                <Button
                  variant="outline"
                  onClick={handlePauseScan}
                  className="gap-2 border-neon-yellow/30 text-neon-yellow"
                >
                  <Pause className="w-4 h-4" /> Pause
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelScan}
                  className="gap-2 border-destructive/30 text-destructive hover:glow-orange"
                >
                  <Square className="w-4 h-4" /> Force Stop
                </Button>
              </>
            )}
            {scanStatus === "paused" && (
              <>
                <Button
                  onClick={handleResumeScan}
                  className="gap-2 glow-cyan"
                >
                  <Play className="w-4 h-4" /> Resume
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelScan}
                  className="gap-2 border-destructive/30 text-destructive hover:glow-orange"
                >
                  <Square className="w-4 h-4" /> Force Stop
                </Button>
              </>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Auto-Scan</Label>
              <p className="text-xs text-muted-foreground">
                Automatically scan for deals on an interval.
              </p>
            </div>
            <Switch
              checked={settings.auto_scan_enabled !== "false"}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, auto_scan_enabled: String(checked) })
              }
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-mono">SCAN INTERVAL</Label>
            <Select
              value={settings.scan_interval_minutes || "60"}
              onValueChange={(v) =>
                setSettings({ ...settings, scan_interval_minutes: v })
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="240">4 hours</SelectItem>
                <SelectItem value="360">6 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Use Proxies</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, workers use proxies (each with its own rate limit). When disabled, 1 worker only.
              </p>
            </div>
            <Switch
              checked={useProxies}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, use_proxies: String(checked) })
              }
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-mono">WORKER COUNT (5–15)</Label>
            <Select
              value={useProxies ? (settings.worker_count || "5") : "1"}
              onValueChange={(v) =>
                setSettings({ ...settings, worker_count: v })
              }
              disabled={!useProxies}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} {!useProxies && n === 1 ? "(no proxy)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!useProxies && (
              <p className="text-xs text-muted-foreground">
                With proxies disabled, only 1 worker is used to avoid rate limits.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Proxies */}
      <Card className="border-border/30">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-mono uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Proxies
                {proxiesList.length > 0 && (
                  <span className="flex items-center gap-1.5 font-normal text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                      {proxiesList.length} total
                    </Badge>
                    <Badge variant="outline" className="text-xs text-neon-green border-neon-green/30">
                      {proxiesList.filter((p) => p.isAlive).length} alive
                    </Badge>
                    <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                      {proxiesList.filter((p) => !p.isAlive).length} dead
                    </Badge>
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Add proxy URLs (e.g. http://user:pass@host:port). Each proxy has its own rate limit. Dead proxies are auto-skipped.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {serverIp && (
            <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">Server IP:</span>
              <code className="text-sm font-mono text-neon-cyan">{serverIp}</code>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 ml-1"
                onClick={() => {
                  navigator.clipboard.writeText(serverIp);
                  setIpCopied(true);
                  setTimeout(() => setIpCopied(false), 2000);
                }}
              >
                {ipCopied ? (
                  <Check className="w-3.5 h-3.5 text-neon-green" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>
              <span className="text-[10px] text-muted-foreground ml-auto">
                Requests without proxy go from this IP
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <textarea
              className="flex-1 min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="One proxy URL per line..."
              value={proxyUrls}
              onChange={(e) => setProxyUrls(e.target.value)}
            />
            <Button onClick={handleAddProxies} className="shrink-0">
              Add
            </Button>
          </div>
          {proxiesList.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={handleRemoveDead}>
                  Remove dead
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckAll}
                  disabled={checkAllLoading}
                  className="gap-1.5"
                >
                  {checkAllLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {checkAllLoading ? "Checking..." : "Check all"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveAll}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remove all
                </Button>
              </div>
              <div className="rounded-md border border-border/50 overflow-hidden max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/50 z-10">
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left p-2 font-mono">URL</th>
                      <th className="text-left p-2 w-20">Status</th>
                      <th className="text-left p-2 w-16">Fails</th>
                      <th className="text-left p-2 w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proxiesList.map((p) => (
                      <tr key={p.id} className="border-b border-border/30">
                        <td className="p-2 font-mono text-xs truncate max-w-[300px]" title={p.url}>
                          {p.url}
                        </td>
                        <td className="p-2">
                          <span className={p.isAlive ? "text-neon-green" : "text-destructive"}>
                            {p.isAlive ? "Alive" : "Dead"}
                          </span>
                        </td>
                        <td className="p-2 font-mono">{p.failCount}</td>
                        <td className="p-2 flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            disabled={proxyTestingId !== null || checkAllLoading}
                            onClick={() => handleTestProxy(p.id)}
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => handleDeleteProxy(p.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Endo Benchmarks */}
      <Card className="border-border/30">
        <CardHeader>
          <CardTitle className="text-sm font-mono uppercase tracking-wider">
            Endo Benchmarks
          </CardTitle>
          <CardDescription>
            Configure market prices for endo sources. The liquidity threshold is
            derived from the best (highest) endo/plat rate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-mono">
                ANTIVIRUS MOD PRICE (PLAT)
              </Label>
              <Input
                type="number"
                value={settings.antivirus_mod_price || "4"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    antivirus_mod_price: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground font-mono">
                1,000 endo ={" "}
                {Math.round(
                  1000 / Number(settings.antivirus_mod_price || 4)
                )}{" "}
                endo/plat
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-mono">
                AYATAN ANASA PRICE (PLAT)
              </Label>
              <Input
                type="number"
                value={settings.ayatan_anasa_price || "9"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    ayatan_anasa_price: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground font-mono">
                3,450 endo ={" "}
                {Math.round(
                  3450 / Number(settings.ayatan_anasa_price || 9)
                )}{" "}
                endo/plat
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
            <p className="text-sm font-medium text-primary font-mono">
              Liquidity Threshold:{" "}
              {Math.round(
                Math.max(
                  1000 / Number(settings.antivirus_mod_price || 4),
                  3450 / Number(settings.ayatan_anasa_price || 9)
                )
              )}{" "}
              endo/plat
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Reference Data */}
      <Card className="border-border/30">
        <CardHeader>
          <CardTitle className="text-sm font-mono uppercase tracking-wider">
            Reference Data
          </CardTitle>
          <CardDescription>
            Sync weapon names and riven attributes from Warframe Market into the local database.
            This enables autocomplete and stat filtering without hitting the WFM API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="gap-2"
            onClick={async () => {
              toast.info("Syncing reference data...");
              try {
                const res = await fetch("/api/reference/sync", { method: "POST" });
                const data = await res.json();
                if (res.ok) {
                  toast.success(
                    `Synced ${data.weaponsSynced} weapons, ${data.attrsSynced} attributes`
                  );
                } else {
                  toast.error(data.error ?? "Sync failed");
                }
              } catch {
                toast.error("Sync failed");
              }
            }}
          >
            <Globe className="w-4 h-4" />
            Sync Reference Data
          </Button>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 glow-cyan">
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
