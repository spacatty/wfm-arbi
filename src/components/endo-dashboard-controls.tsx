"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ScanControls } from "./scan-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

export function EndoDashboardControls() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  const [maxPrice, setMaxPrice] = useState("50");
  const [minEndo, setMinEndo] = useState("2000");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/settings");
        const data = await res.json();
        const s = data.settings ?? {};
        setMaxPrice(s.rank_scan_max_price ?? "50");
        setMinEndo(s.rank_scan_min_endo ?? "2000");
      } catch {
        /* ignore */
      } finally {
        setLoaded(true);
      }
    };
    load();
  }, []);

  const handleSaveScanSettings = async () => {
    const max = parseInt(maxPrice, 10);
    const min = parseInt(minEndo, 10);
    if (Number.isNaN(max) || max < 1 || max > 1000) {
      toast.error("Max price must be 1–1000");
      return;
    }
    if (Number.isNaN(min) || min < 0) {
      toast.error("Min endo must be ≥ 0");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rank_scan_max_price: max,
          rank_scan_min_endo: min,
        }),
      });
      if (res.ok) {
        toast.success("Scan settings saved");
      } else {
        const d = await res.json();
        toast.error(d.error ?? "Failed to save");
      }
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="shrink-0 space-y-2">
      <ScanControls apiBase="/api/scan" label="Scan" />

      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {settingsOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            Rank scan settings
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {loaded && (
            <div className="pt-2 space-y-2 pl-4 border-l border-border/30">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Max price (p)</Label>
                  <Input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    disabled={!isAdmin}
                    className="h-8 text-xs font-mono"
                    min={1}
                    max={1000}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Min endo</Label>
                  <Input
                    type="number"
                    value={minEndo}
                    onChange={(e) => setMinEndo(e.target.value)}
                    disabled={!isAdmin}
                    className="h-8 text-xs font-mono"
                    min={0}
                  />
                </div>
              </div>
              {isAdmin && (
                <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSaveScanSettings} disabled={saving}>
                  {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
                  Save
                </Button>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
