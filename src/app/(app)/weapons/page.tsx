"use client";

import { useEffect, useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Search, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WeaponRow {
  weaponUrlName: string;
  weaponName: string;
  rivenType: string | null;
  enabled: boolean;
  tier: string;
  lastScannedAt: string | null;
  liquidCount: number;
  auctionCount: number;
}

function tierColor(tier: string) {
  if (tier === "hot") return "bg-neon-green/20 text-neon-green border-neon-green/30";
  if (tier === "cold") return "bg-muted text-muted-foreground border-border";
  return "bg-primary/20 text-primary border-primary/30";
}

export default function WeaponsPage() {
  const [weapons, setWeapons] = useState<WeaponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);

  const fetchWeapons = async () => {
    try {
      const res = await fetch("/api/weapons");
      const data = await res.json();
      setWeapons(data.weapons ?? []);
    } catch {
      toast.error("Failed to load weapons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeapons();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return weapons;
    const q = search.trim().toLowerCase();
    return weapons.filter(
      (w) =>
        w.weaponName.toLowerCase().includes(q) ||
        w.weaponUrlName.toLowerCase().includes(q)
    );
  }, [weapons, search]);

  const byCategory = useMemo(() => {
    const map: Record<string, WeaponRow[]> = {};
    for (const w of filtered) {
      const cat = w.rivenType ?? "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(w);
    }
    const order = ["Rifle", "Pistol", "Shotgun", "Melee", "Zaw", "Kitgun", "Archgun", "Other"];
    const sorted: [string, WeaponRow[]][] = [];
    for (const cat of order) {
      if (map[cat]?.length) sorted.push([cat, map[cat]]);
    }
    for (const cat of Object.keys(map)) {
      if (!order.includes(cat)) sorted.push([cat, map[cat]]);
    }
    return sorted;
  }, [filtered]);

  const toggleWeapons = async (urlNames: string[], enabled: boolean) => {
    setPending(true);
    try {
      const res = await fetch("/api/weapons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaponUrlNames: urlNames, enabled }),
      });
      if (res.ok) {
        setWeapons((prev) =>
          prev.map((w) =>
            urlNames.includes(w.weaponUrlName) ? { ...w, enabled } : w
          )
        );
        toast.success(
          enabled ? `Enabled ${urlNames.length} weapons` : `Disabled ${urlNames.length} weapons`
        );
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update");
      }
    } catch {
      toast.error("Failed to update");
    } finally {
      setPending(false);
    }
  };

  const toggleOne = (urlName: string, enabled: boolean) => {
    toggleWeapons([urlName], enabled);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Weapon Pool</h1>
        <p className="text-sm text-muted-foreground">
          Choose which weapons to include in scans. Disabled weapons are skipped.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 font-mono"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || filtered.length === 0}
          onClick={() =>
            toggleWeapons(
              filtered.map((w) => w.weaponUrlName),
              filtered.every((w) => !w.enabled)
            )
          }
        >
          {filtered.every((w) => w.enabled)
            ? "Deselect all"
            : "Select all"}
        </Button>
      </div>

      {byCategory.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No weapons in scan log yet. Run a scan from Admin to seed the weapon list.
        </p>
      ) : (
        <div className="space-y-2">
          {byCategory.map(([category, list]) => {
            const isOpen = openCategories[category] ?? true;
            const enabledInCat = list.filter((w) => w.enabled).length;
            return (
              <Collapsible
                key={category}
                open={isOpen}
                onOpenChange={(o) =>
                  setOpenCategories((prev) => ({ ...prev, [category]: o }))
                }
              >
                <div className="rounded-lg border border-border/50 bg-card/40">
                  <div className="flex w-full items-center justify-between px-4 py-3 rounded-lg">
                    <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left hover:bg-muted/30 transition-colors rounded-lg py-1 -my-1">
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold">{category}</span>
                      <Badge variant="secondary" className="text-xs">
                        {enabledInCat}/{list.length}
                      </Badge>
                    </CollapsibleTrigger>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={pending || enabledInCat === 0}
                        onClick={() =>
                          toggleWeapons(
                            list.map((w) => w.weaponUrlName),
                            false
                          )
                        }
                      >
                        Deselect all
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={pending || enabledInCat === list.length}
                        onClick={() =>
                          toggleWeapons(
                            list.map((w) => w.weaponUrlName),
                            true
                          )
                        }
                      >
                        Select all
                      </Button>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="border-t border-border/50 px-4 py-2 max-h-64 overflow-y-auto">
                      <div className="grid gap-1.5">
                        {list.map((w) => (
                          <div
                            key={w.weaponUrlName}
                            className="flex items-center gap-3 py-1.5 rounded px-2 hover:bg-muted/20"
                          >
                            <Checkbox
                              checked={w.enabled}
                              onCheckedChange={(checked: boolean | "indeterminate") =>
                                toggleOne(w.weaponUrlName, checked === true)
                              }
                              disabled={pending}
                            />
                            <span className="font-mono text-sm flex-1 truncate">
                              {w.weaponName || w.weaponUrlName}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs shrink-0 ${tierColor(w.tier)}`}
                            >
                              {w.tier}
                            </Badge>
                            {w.liquidCount > 0 && (
                              <span className="text-xs text-neon-green font-mono">
                                {w.liquidCount} liquid
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
