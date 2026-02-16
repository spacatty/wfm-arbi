"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Separator } from "@/components/ui/separator";
import { RivenStatCard } from "@/components/riven-stat-card";
import { useWhisperTemplate } from "@/components/user-profile-context";
import {
  Search,
  Loader2,
  Circle,
  ChevronsUpDown,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import type { RivenSnapshot } from "@/lib/db/schema";

interface WeaponOption {
  urlName: string;
  weaponName: string;
  rivenType: string | null;
  icon: string | null;
  thumb: string | null;
}

interface AttributeOption {
  urlName: string;
  effect: string;
  group: string;
  units: string | null;
  positiveIsNegative: boolean;
  negativeOnly: boolean;
  searchOnly: boolean;
  exclusiveTo: string | null;
}

interface SearchResponse {
  results: RivenSnapshot[];
  cached: boolean;
  count: number;
}

export default function SearchPage() {
  const [weapon, setWeapon] = useState<WeaponOption | null>(null);
  const [weaponOpen, setWeaponOpen] = useState(false);
  const [weaponSearch, setWeaponSearch] = useState("");
  const [weaponOptions, setWeaponOptions] = useState<WeaponOption[]>([]);
  const [weaponLoading, setWeaponLoading] = useState(false);

  const [positiveStats, setPositiveStats] = useState<AttributeOption[]>([]);
  const [negativeStats, setNegativeStats] = useState<AttributeOption[]>([]);
  const [statOptions, setStatOptions] = useState<AttributeOption[]>([]);
  const [posOpen, setPosOpen] = useState(false);
  const [negOpen, setNegOpen] = useState(false);

  const [polarity, setPolarity] = useState("any");
  const [reRollsMin, setReRollsMin] = useState("");
  const [reRollsMax, setReRollsMax] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sortBy, setSortBy] = useState("price_asc");
  const [buyoutPolicy, setBuyoutPolicy] = useState("direct");
  const [tab, setTab] = useState("all");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const whisperTemplate = useWhisperTemplate();

  const attrMap = useRef(
    new Map<
      string,
      {
        urlName: string;
        effect: string;
        units: string | null;
        positiveIsNegative: boolean;
      }
    >()
  );

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced weapon search
  useEffect(() => {
    if (weaponSearch.length < 2) {
      setWeaponOptions([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setWeaponLoading(true);
      try {
        const res = await fetch(
          `/api/reference/weapons?q=${encodeURIComponent(weaponSearch)}`
        );
        const json = await res.json();
        if (json.weapons) setWeaponOptions(json.weapons);
      } catch {
        /* ignore */
      }
      setWeaponLoading(false);
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [weaponSearch]);

  // Load attributes when weapon changes
  useEffect(() => {
    if (!weapon) {
      setStatOptions([]);
      return;
    }
    (async () => {
      try {
        const params = weapon.rivenType
          ? `?riven_type=${weapon.rivenType}`
          : "";
        const res = await fetch(`/api/reference/attributes${params}`);
        const json = await res.json();
        if (json.attributes) {
          setStatOptions(json.attributes);
          const m = new Map<
            string,
            {
              urlName: string;
              effect: string;
              units: string | null;
              positiveIsNegative: boolean;
            }
          >();
          for (const a of json.attributes) {
            m.set(a.urlName, {
              urlName: a.urlName,
              effect: a.effect,
              units: a.units,
              positiveIsNegative: a.positiveIsNegative,
            });
          }
          attrMap.current = m;
        }
      } catch {
        /* ignore */
      }
    })();
  }, [weapon]);

  // Auto-sync reference data if empty
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/reference/weapons?q=a");
        const json = await res.json();
        if (!json.weapons || json.weapons.length === 0) {
          setSyncing(true);
          const syncRes = await fetch("/api/reference/sync", {
            method: "POST",
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            toast.success(
              `Synced ${syncData.weaponsSynced} weapons, ${syncData.attrsSynced} attributes`
            );
          }
          setSyncing(false);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const handleSearch = useCallback(async () => {
    if (!weapon) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        weapon: weapon.urlName,
        sort_by: sortBy,
        buyout_policy: buyoutPolicy,
      });
      if (positiveStats.length > 0)
        params.set("positive_stats", positiveStats.map((s) => s.urlName).join(","));
      if (negativeStats.length > 0)
        params.set("negative_stats", negativeStats.map((s) => s.urlName).join(","));
      if (polarity !== "any") params.set("polarity", polarity);
      if (reRollsMin) params.set("re_rolls_min", reRollsMin);
      if (reRollsMax) params.set("re_rolls_max", reRollsMax);
      if (maxPrice) params.set("max_price", maxPrice);
      if (tab !== "all") params.set("status", tab);

      const res = await fetch(`/api/rivens/search?${params.toString()}`);
      const json = await res.json();
      setData(json);
    } catch {
      toast.error("Search failed");
    } finally {
      setLoading(false);
    }
  }, [weapon, positiveStats, negativeStats, polarity, reRollsMin, reRollsMax, maxPrice, sortBy, buyoutPolicy, tab]);

  const filteredResults = data?.results?.filter((r) => {
    if (tab === "online")
      return r.ownerStatus === "online" || r.ownerStatus === "ingame";
    if (tab === "offline") return r.ownerStatus === "offline";
    return true;
  });

  const onlineCount =
    data?.results?.filter(
      (r) => r.ownerStatus === "online" || r.ownerStatus === "ingame"
    ).length ?? 0;
  const offlineCount =
    data?.results?.filter((r) => r.ownerStatus === "offline").length ?? 0;

  const posPickerOptions = statOptions.filter((a) => !a.negativeOnly);
  const negPickerOptions = statOptions.filter((a) => !a.searchOnly);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Riven Search</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Search WFM auctions with filters &mdash; local autocomplete, live results
          </p>
        </div>
        {syncing && (
          <Badge variant="outline" className="gap-1 text-xs animate-pulse">
            <RefreshCw className="size-3 animate-spin" />
            Syncing...
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-4 rounded-lg border border-border/30 bg-card/30 p-4">
        {/* Row 1: Weapon */}
        <div className="space-y-1.5">
          <Label className="text-xs font-mono text-muted-foreground">WEAPON</Label>
          <Popover open={weaponOpen} onOpenChange={setWeaponOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between font-mono text-sm h-9"
              >
                {weapon ? (
                  <span className="truncate">
                    {weapon.weaponName}
                    {weapon.rivenType && (
                      <span className="text-muted-foreground ml-1.5 text-xs">
                        {weapon.rivenType}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Select weapon...</span>
                )}
                <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Type to search..."
                  value={weaponSearch}
                  onValueChange={setWeaponSearch}
                />
                <CommandList>
                  {weaponLoading && (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <CommandEmpty>
                    {weaponSearch.length < 2
                      ? "Type at least 2 characters..."
                      : "No weapons found."}
                  </CommandEmpty>
                  <CommandGroup>
                    {weaponOptions.map((w) => (
                      <CommandItem
                        key={w.urlName}
                        value={w.urlName}
                        onSelect={() => {
                          setWeapon(w);
                          setWeaponOpen(false);
                          setWeaponSearch("");
                          setPositiveStats([]);
                          setNegativeStats([]);
                        }}
                      >
                        <Check
                          className={`mr-2 size-3.5 ${
                            weapon?.urlName === w.urlName
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                        <span className="flex-1 truncate">{w.weaponName}</span>
                        {w.rivenType && (
                          <Badge variant="outline" className="ml-1 text-[10px] h-4">
                            {w.rivenType}
                          </Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Row 2: Dropdowns grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-mono text-muted-foreground">POLARITY</Label>
            <Select value={polarity} onValueChange={setPolarity}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="madurai">Madurai (V)</SelectItem>
                <SelectItem value="vazarin">Vazarin (D)</SelectItem>
                <SelectItem value="naramon">Naramon (--)</SelectItem>
                <SelectItem value="zenurik">Zenurik (=)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-mono text-muted-foreground">SORT BY</Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="price_asc">Price low</SelectItem>
                <SelectItem value="price_desc">Price high</SelectItem>
                <SelectItem value="endo_per_plat">Endo/Plat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-mono text-muted-foreground">TYPE</Label>
            <Select value={buyoutPolicy} onValueChange={setBuyoutPolicy}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="direct">Direct sell</SelectItem>
                <SelectItem value="with">With buyout</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-mono text-muted-foreground">MAX PRICE</Label>
            <Input
              type="number"
              placeholder="Any"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Row 3: Re-rolls */}
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-mono text-muted-foreground">RE-ROLLS MIN</Label>
            <Input
              type="number"
              placeholder="0"
              value={reRollsMin}
              onChange={(e) => setReRollsMin(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-mono text-muted-foreground">RE-ROLLS MAX</Label>
            <Input
              type="number"
              placeholder="Any"
              value={reRollsMax}
              onChange={(e) => setReRollsMax(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* Row 4: Stats pickers (only when weapon selected) */}
        {weapon && statOptions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Positive */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-mono text-neon-green">POSITIVE STATS</Label>
              <Popover open={posOpen} onOpenChange={setPosOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-xs h-8"
                  >
                    <span className="truncate">
                      {positiveStats.length > 0
                        ? positiveStats.map((s) => s.effect).join(", ")
                        : "Any"}
                    </span>
                    <ChevronsUpDown className="ml-2 size-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search stats..." />
                    <CommandList>
                      <CommandEmpty>No stats found.</CommandEmpty>
                      <CommandGroup>
                        {posPickerOptions.map((attr) => {
                          const sel = positiveStats.some(
                            (s) => s.urlName === attr.urlName
                          );
                          return (
                            <CommandItem
                              key={attr.urlName}
                              value={attr.effect}
                              onSelect={() =>
                                setPositiveStats((prev) =>
                                  sel
                                    ? prev.filter((s) => s.urlName !== attr.urlName)
                                    : [...prev, attr]
                                )
                              }
                            >
                              <Check
                                className={`mr-2 size-3.5 ${
                                  sel ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              {attr.effect}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {positiveStats.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {positiveStats.map((s) => (
                    <Badge
                      key={s.urlName}
                      variant="outline"
                      className="text-[10px] gap-1 border-neon-green/30 text-neon-green cursor-pointer h-5"
                      onClick={() =>
                        setPositiveStats((p) =>
                          p.filter((x) => x.urlName !== s.urlName)
                        )
                      }
                    >
                      {s.effect}
                      <X className="size-2.5" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Negative */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-mono text-destructive">NEGATIVE STATS</Label>
              <Popover open={negOpen} onOpenChange={setNegOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between text-xs h-8"
                  >
                    <span className="truncate">
                      {negativeStats.length > 0
                        ? negativeStats.map((s) => s.effect).join(", ")
                        : "Any"}
                    </span>
                    <ChevronsUpDown className="ml-2 size-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search stats..." />
                    <CommandList>
                      <CommandEmpty>No stats found.</CommandEmpty>
                      <CommandGroup>
                        {negPickerOptions.map((attr) => {
                          const sel = negativeStats.some(
                            (s) => s.urlName === attr.urlName
                          );
                          return (
                            <CommandItem
                              key={attr.urlName}
                              value={attr.effect}
                              onSelect={() =>
                                setNegativeStats((prev) =>
                                  sel
                                    ? prev.filter((s) => s.urlName !== attr.urlName)
                                    : [...prev, attr]
                                )
                              }
                            >
                              <Check
                                className={`mr-2 size-3.5 ${
                                  sel ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              {attr.effect}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {negativeStats.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {negativeStats.map((s) => (
                    <Badge
                      key={s.urlName}
                      variant="outline"
                      className="text-[10px] gap-1 border-destructive/30 text-destructive cursor-pointer h-5"
                      onClick={() =>
                        setNegativeStats((p) =>
                          p.filter((x) => x.urlName !== s.urlName)
                        )
                      }
                    >
                      {s.effect}
                      <X className="size-2.5" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search button */}
        <Button
          onClick={handleSearch}
          disabled={loading || !weapon}
          className="w-full sm:w-auto gap-2 h-9"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          Search
        </Button>
      </div>

      {/* Results */}
      {data && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">
              Results
              {data.cached && (
                <Badge variant="outline" className="ml-2 text-[10px]">
                  Cached
                </Badge>
              )}
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              {data.count} found
            </span>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs h-7 px-3">
                All ({data.count})
              </TabsTrigger>
              <TabsTrigger value="online" className="text-xs h-7 px-3 gap-1.5">
                <Circle className="size-1.5 fill-neon-green text-neon-green" />
                Online ({onlineCount})
              </TabsTrigger>
              <TabsTrigger value="offline" className="text-xs h-7 px-3 gap-1.5">
                <Circle className="size-1.5 fill-muted-foreground text-muted-foreground" />
                Offline ({offlineCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            {!filteredResults?.length ? (
              <div className="text-center py-10 text-sm text-muted-foreground rounded-lg border border-border/30">
                No results for this filter.
              </div>
            ) : (
              filteredResults.map((r) => (
                <RivenStatCard
                  key={r.wfmAuctionId}
                  deal={r}
                  attributeMap={attrMap.current}
                  whisperTemplate={whisperTemplate}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
