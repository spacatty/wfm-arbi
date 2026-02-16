"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Archive,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  X,
  CircleDot,
  Pencil,
  Check,
  BarChart3,
  Calculator,
  ArrowRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { PlatIcon, EndoIcon } from "./wf-icons";
import { SortableHead, toggleSort, useSorted, type SortState } from "./sortable-head";

/* ─── Types ──────────────────────────────────────────────────────── */

type TrackerSortCol = "riven" | "cost" | "income" | "profit" | "endoPerPlat" | "reRolls" | "added";

interface IncomeEntry {
  id: string;
  trackedDealId: string;
  amount: number;
  note: string | null;
  createdAt: string;
}

interface TrackedDealRow {
  id: string;
  source: string;
  weaponUrlName: string;
  weaponName: string;
  rivenName: string | null;
  reRolls: number;
  modRank: number;
  masteryLevel: number;
  buyPrice: number;
  endoValue: number;
  endoPerPlat: number;
  polarity: string | null;
  sellerIgn: string;
  wfmAuctionUrl: string | null;
  platform: string;
  status: string;
  notes: string | null;
  createdAt: string;
  archivedAt: string | null;
  totalIncome: number;
  incomeCount: number;
  profit: number;
}

interface TrackerStats {
  totalDeals: number;
  activeDeals: number;
  totalInvested: number;
  totalIncome: number;
  netProfit: number;
  activeInvested: number;
  activeIncome: number;
}

interface TrackerResponse {
  deals: TrackedDealRow[];
  stats: TrackerStats;
  liquidityThreshold: number;
}

interface ModSaleRow {
  id: string;
  modName: string;
  buyPrice: number;
  endoUsed: number;
  sellPrice: number;
  note: string | null;
  createdAt: string;
}

/* ─── Helpers ────────────────────────────────────────────────────── */

function fmtPctDiff(endoPerPlat: number, threshold: number): { text: string; color: string } {
  if (!threshold || !endoPerPlat) return { text: "", color: "" };
  const pct = ((endoPerPlat - threshold) / threshold) * 100;
  const sign = pct >= 0 ? "+" : "";
  return { text: `${sign}${Math.round(pct)}%`, color: pct >= 0 ? "text-neon-green" : "text-destructive" };
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function fmtEndo(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/* ─── Income Panel ───────────────────────────────────────────────── */

function IncomePanel({ dealId, onIncomeChange }: { dealId: string; onIncomeChange: () => void }) {
  const [income, setIncome] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchIncome = useCallback(async () => {
    try {
      const res = await fetch(`/api/tracker/${dealId}/income`);
      const data = await res.json();
      setIncome(data.income ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [dealId]);

  useEffect(() => { fetchIncome(); }, [fetchIncome]);

  const handleAdd = async () => {
    const num = parseFloat(amount);
    if (!num || num <= 0) { toast.error("Enter a valid plat amount"); return; }
    setAdding(true);
    try {
      const res = await fetch(`/api/tracker/${dealId}/income`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, note: note || null }),
      });
      if (res.ok) { toast.success(`+${Math.round(num)}p`); setAmount(""); setNote(""); fetchIncome(); onIncomeChange(); }
      else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
    } catch { toast.error("Failed"); }
    setAdding(false);
  };

  const handleDeleteIncome = async (incomeId: string) => {
    try {
      const res = await fetch(`/api/tracker/${dealId}/income/${incomeId}`, { method: "DELETE" });
      if (res.ok) { fetchIncome(); onIncomeChange(); }
    } catch { toast.error("Failed"); }
  };

  const total = income.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="bg-muted/20 rounded-lg border border-border/20 p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Input type="number" placeholder="Plat" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-8 text-sm w-24 font-mono bg-background/60" min={1} />
        <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="h-8 text-sm flex-1 min-w-[120px] bg-background/60" />
        <Button size="sm" className="h-8 cursor-pointer" onClick={handleAdd} disabled={adding}>
          {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add income
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
      ) : income.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">No income recorded yet</p>
      ) : (
        <div className="space-y-1.5">
          {income.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-sm bg-background/40 rounded-md px-3 py-2">
              <span className="font-mono font-semibold text-neon-green">+{entry.amount}</span>
              {entry.note && <span className="text-muted-foreground text-sm truncate mx-2 flex-1">{entry.note}</span>}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground font-mono">{timeAgo(entry.createdAt)}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => handleDeleteIncome(entry.id)}><X className="size-3.5" /></Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">Remove income</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
          <div className="text-right text-sm font-mono text-muted-foreground pt-1">Total: <span className="text-neon-green font-bold">{total}p</span></div>
        </div>
      )}
    </div>
  );
}

/* ─── Manual Deal Dialog ──────────────────────────────────────────── */

function ManualDealDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"riven" | "manual">("manual");

  const [rivenForm, setRivenForm] = useState({
    weaponName: "", rivenName: "", buyPrice: "", endoValue: "", reRolls: "",
    modRank: "0", masteryLevel: "8", sellerIgn: "", wfmAuctionUrl: "",
    source: "rank_value" as "rank_value" | "reroll_value",
  });
  const [manualForm, setManualForm] = useState({ title: "", buyPrice: "", note: "" });

  const setR = (key: string, val: string) => setRivenForm((prev) => ({ ...prev, [key]: val }));
  const setM = (key: string, val: string) => setManualForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    if (mode === "manual") {
      if (!manualForm.title.trim()) { toast.error("Title is required"); return; }
      const buyPrice = parseInt(manualForm.buyPrice);
      if (!buyPrice || buyPrice <= 0) { toast.error("Buy price must be positive"); return; }
      setSaving(true);
      try {
        const res = await fetch("/api/tracker", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "manual", weaponUrlName: manualForm.title.toLowerCase().replace(/\s+/g, "_"), weaponName: manualForm.title.trim(), buyPrice, notes: manualForm.note.trim() || null }),
        });
        if (res.ok) { toast.success("Deal added"); setManualForm({ title: "", buyPrice: "", note: "" }); setOpen(false); onAdded(); }
        else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
      } catch { toast.error("Failed"); }
      setSaving(false);
    } else {
      if (!rivenForm.weaponName.trim()) { toast.error("Weapon name is required"); return; }
      const buyPrice = parseInt(rivenForm.buyPrice);
      if (!buyPrice || buyPrice <= 0) { toast.error("Buy price must be positive"); return; }
      setSaving(true);
      try {
        const endoValue = parseInt(rivenForm.endoValue) || 0;
        const res = await fetch("/api/tracker", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: rivenForm.source, weaponUrlName: rivenForm.weaponName.toLowerCase().replace(/\s+/g, "_"), weaponName: rivenForm.weaponName.trim(),
            rivenName: rivenForm.rivenName.trim() || null, reRolls: parseInt(rivenForm.reRolls) || 0, modRank: parseInt(rivenForm.modRank) || 0,
            masteryLevel: parseInt(rivenForm.masteryLevel) || 8, buyPrice, endoValue, endoPerPlat: buyPrice > 0 ? endoValue / buyPrice : 0,
            sellerIgn: rivenForm.sellerIgn.trim() || null, wfmAuctionUrl: rivenForm.wfmAuctionUrl.trim() || null, platform: "pc",
          }),
        });
        if (res.ok) { toast.success("Deal added"); setRivenForm({ weaponName: "", rivenName: "", buyPrice: "", endoValue: "", reRolls: "", modRank: "0", masteryLevel: "8", sellerIgn: "", wfmAuctionUrl: "", source: "rank_value" }); setOpen(false); onAdded(); }
        else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
      } catch { toast.error("Failed"); }
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="cursor-pointer"><Plus className="size-3" />Add Deal</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-sm">Add Deal</DialogTitle></DialogHeader>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "riven" | "manual")} className="w-full">
          <TabsList className="w-full h-8">
            <TabsTrigger value="manual" className="flex-1 text-xs h-7">Manual</TabsTrigger>
            <TabsTrigger value="riven" className="flex-1 text-xs h-7">Riven</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="grid gap-3 py-1">
          {mode === "manual" ? (
            <>
              <div className="space-y-1"><Label className="text-xs">Title *</Label><Input placeholder="e.g. Kronen Riven, Arcane Energize…" value={manualForm.title} onChange={(e) => setM("title", e.target.value)} className="h-8 text-xs" autoFocus /></div>
              <div className="space-y-1"><Label className="text-xs"><span className="inline-flex items-center gap-0.5">Buy Price <PlatIcon className="size-2.5" /> *</span></Label><Input type="number" placeholder="0" value={manualForm.buyPrice} onChange={(e) => setM("buyPrice", e.target.value)} className="h-8 text-xs font-mono" min={1} /></div>
              <div className="space-y-1"><Label className="text-xs">Note</Label><Input placeholder="(optional)" value={manualForm.note} onChange={(e) => setM("note", e.target.value)} className="h-8 text-xs" /></div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Weapon *</Label><Input placeholder="Kronen" value={rivenForm.weaponName} onChange={(e) => setR("weaponName", e.target.value)} className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">Riven Name</Label><Input placeholder="Croni-critadex" value={rivenForm.rivenName} onChange={(e) => setR("rivenName", e.target.value)} className="h-8 text-xs" /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">Buy <PlatIcon className="size-2.5 inline" /> *</Label><Input type="number" placeholder="0" value={rivenForm.buyPrice} onChange={(e) => setR("buyPrice", e.target.value)} className="h-8 text-xs font-mono" min={1} /></div>
                <div className="space-y-1"><Label className="text-xs">Endo <EndoIcon className="size-2.5 inline" /></Label><Input type="number" placeholder="0" value={rivenForm.endoValue} onChange={(e) => setR("endoValue", e.target.value)} className="h-8 text-xs font-mono" min={0} /></div>
                <div className="space-y-1"><Label className="text-xs">Rerolls</Label><Input type="number" placeholder="0" value={rivenForm.reRolls} onChange={(e) => setR("reRolls", e.target.value)} className="h-8 text-xs font-mono" min={0} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label className="text-xs">MR</Label><Input type="number" value={rivenForm.masteryLevel} onChange={(e) => setR("masteryLevel", e.target.value)} className="h-8 text-xs font-mono" min={8} max={16} /></div>
                <div className="space-y-1"><Label className="text-xs">Rank</Label><Input type="number" value={rivenForm.modRank} onChange={(e) => setR("modRank", e.target.value)} className="h-8 text-xs font-mono" min={0} max={8} /></div>
                <div className="space-y-1"><Label className="text-xs">Source</Label><Select value={rivenForm.source} onValueChange={(v) => setR("source", v)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="rank_value" className="text-xs">Rank Value</SelectItem><SelectItem value="reroll_value" className="text-xs">Reroll Value</SelectItem></SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Seller IGN</Label><Input placeholder="(optional)" value={rivenForm.sellerIgn} onChange={(e) => setR("sellerIgn", e.target.value)} className="h-8 text-xs" /></div>
                <div className="space-y-1"><Label className="text-xs">WFM URL</Label><Input placeholder="(optional)" value={rivenForm.wfmAuctionUrl} onChange={(e) => setR("wfmAuctionUrl", e.target.value)} className="h-8 text-xs" /></div>
              </div>
            </>
          )}
          <Button size="sm" className="mt-1 cursor-pointer" onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />} Add to Tracker
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Editable Mod Sale Row ──────────────────────────────────────── */

function EditableModSaleRow({
  sale, onSave, onCancel,
}: {
  sale: ModSaleRow;
  onSave: (id: string, data: { modName: string; buyPrice: string; endoUsed: string; sellPrice: string }) => void;
  onCancel: () => void;
}) {
  const [modName, setModName] = useState(sale.modName);
  const [buyPrice, setBuyPrice] = useState(String(sale.buyPrice));
  const [endoUsed, setEndoUsed] = useState(String(sale.endoUsed));
  const [sellPrice, setSellPrice] = useState(String(sale.sellPrice));

  return (
    <TableRow className="border-border/10 bg-primary/5">
      <TableCell className="px-4 py-2.5"><Input value={modName} onChange={(e) => setModName(e.target.value)} className="h-8 text-sm" autoFocus /></TableCell>
      <TableCell className="px-4 py-2.5"><Input type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} className="h-8 text-sm font-mono w-20" /></TableCell>
      <TableCell className="px-4 py-2.5"><Input type="number" value={endoUsed} onChange={(e) => setEndoUsed(e.target.value)} className="h-8 text-sm font-mono w-24" /></TableCell>
      <TableCell className="px-4 py-2.5"><Input type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} className="h-8 text-sm font-mono w-20" /></TableCell>
      <TableCell className="px-4 py-2.5" />
      <TableCell className="px-4 py-2.5">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-neon-green hover:text-neon-green" onClick={() => onSave(sale.id, { modName, buyPrice, endoUsed, sellPrice })}><Check className="size-3.5" /></Button>
            </TooltipTrigger>
            <TooltipContent side="top">Save</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer" onClick={onCancel}><X className="size-3.5" /></Button>
            </TooltipTrigger>
            <TooltipContent side="top">Cancel</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN TRACKER DASHBOARD
   ═══════════════════════════════════════════════════════════════════ */

export function TrackerDashboard() {
  const [data, setData] = useState<TrackerResponse | null>(null);
  const [sales, setSales] = useState<ModSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState<TrackerSortCol>>({ col: "added", dir: "desc" });
  const [editingSale, setEditingSale] = useState<string | null>(null);
  const [miscStatsOpen, setMiscStatsOpen] = useState(false);
  const [estimatePlat, setEstimatePlat] = useState("");
  const [estimateEndo, setEstimateEndo] = useState("");

  // Mod sale form (in modal) — mod name controlled for suggestions; numbers uncontrolled for browser memory
  const [addSaleOpen, setAddSaleOpen] = useState(false);
  const [sAdding, setSAdding] = useState(false);
  const [modNameValue, setModNameValue] = useState("");
  const [suggestionHighlight, setSuggestionHighlight] = useState(0);
  const [modNameSuggestionsOpen, setModNameSuggestionsOpen] = useState(false);
  const [endoSuggestionsOpen, setEndoSuggestionsOpen] = useState(false);
  const [endoHighlight, setEndoHighlight] = useState(0);
  const modNameBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endoBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addSaleFormRef = useRef<HTMLFormElement>(null);
  const modNameInputRef = useRef<HTMLInputElement>(null);
  const endoInputRef = useRef<HTMLInputElement>(null);

  // Last recorded buy/endo/sell per mod (most recent sale wins)
  const modSuggestions = useMemo(() => {
    const byName = new Map<string, { modName: string; buyPrice: number; endoUsed: number; sellPrice: number }>();
    const sorted = [...sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    for (const s of sorted) {
      if (!byName.has(s.modName)) byName.set(s.modName, { modName: s.modName, buyPrice: s.buyPrice, endoUsed: s.endoUsed, sellPrice: s.sellPrice });
    }
    return Array.from(byName.values());
  }, [sales]);

  const filteredModSuggestions = useMemo(() => {
    if (!modNameValue.trim()) return modSuggestions.slice(0, 8);
    const q = modNameValue.trim().toLowerCase();
    return modSuggestions.filter((m) => m.modName.toLowerCase().includes(q)).slice(0, 8);
  }, [modSuggestions, modNameValue]);

  // Unique endo values from sales (most recent first), for endo field suggestions
  const endoSuggestions = useMemo(() => {
    const seen = new Set<number>();
    const list: number[] = [];
    const sorted = [...sales].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    for (const s of sorted) {
      if (s.endoUsed > 0 && !seen.has(s.endoUsed)) {
        seen.add(s.endoUsed);
        list.push(s.endoUsed);
      }
    }
    return list.slice(0, 12);
  }, [sales]);

  const applyModSuggestion = useCallback((s: { modName: string; buyPrice: number; endoUsed: number; sellPrice: number }) => {
    setModNameValue(s.modName);
    const form = addSaleFormRef.current;
    if (form) {
      const buyEl = form.elements.namedItem("mod-sale-buy") as HTMLInputElement;
      const endoEl = form.elements.namedItem("mod-sale-endo") as HTMLInputElement;
      const sellEl = form.elements.namedItem("mod-sale-sell") as HTMLInputElement;
      if (buyEl) buyEl.value = String(s.buyPrice);
      if (endoEl) endoEl.value = String(s.endoUsed);
      if (sellEl) sellEl.value = String(s.sellPrice);
    }
    setSuggestionHighlight(0);
    setModNameSuggestionsOpen(false);
    modNameInputRef.current?.blur();
  }, []);

  const applyEndoSuggestion = useCallback((value: number) => {
    const form = addSaleFormRef.current;
    const endoEl = form?.elements.namedItem("mod-sale-endo") as HTMLInputElement | null;
    if (endoEl) endoEl.value = String(value);
    setEndoSuggestionsOpen(false);
    setEndoHighlight(0);
    endoInputRef.current?.blur();
  }, []);

  useEffect(() => {
    if (!addSaleOpen) {
      setModNameValue("");
      setSuggestionHighlight(0);
      setModNameSuggestionsOpen(false);
      setEndoSuggestionsOpen(false);
      setEndoHighlight(0);
    }
  }, [addSaleOpen]);

  useEffect(() => {
    return () => {
      if (modNameBlurTimerRef.current) clearTimeout(modNameBlurTimerRef.current);
      if (endoBlurTimerRef.current) clearTimeout(endoBlurTimerRef.current);
    };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [trackerRes, salesRes] = await Promise.all([
        fetch(`/api/tracker?status=${tab}`),
        fetch("/api/mod-sales"),
      ]);
      setData(await trackerRes.json());
      setSales((await salesRes.json()).sales ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Deal actions ── */
  const toggleExpand = (id: string) => setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const handleArchive = async (id: string) => { try { const r = await fetch(`/api/tracker/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "archived" }) }); if (r.ok) { toast.success("Archived"); fetchData(); } } catch { toast.error("Failed"); } };
  const handleUnarchive = async (id: string) => { try { const r = await fetch(`/api/tracker/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "active" }) }); if (r.ok) { toast.success("Restored"); fetchData(); } } catch { toast.error("Failed"); } };
  const handleDelete = async (id: string) => { if (!confirm("Delete this deal?")) return; try { const r = await fetch(`/api/tracker/${id}`, { method: "DELETE" }); if (r.ok) { setExpanded((p) => { const n = new Set(p); n.delete(id); return n; }); fetchData(); } } catch { toast.error("Failed"); } };

  /* ── Mod sale actions ── */
  const addModSale = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const form = addSaleFormRef.current;
    if (!form) return;
    const nameEl = form.elements.namedItem("mod-sale-name") as HTMLInputElement | null;
    const modName = modNameValue.trim() || (nameEl ? nameEl.value.trim() : "") || "";
    const buyEl = form.elements.namedItem("mod-sale-buy") as HTMLInputElement | null;
    const endoEl = form.elements.namedItem("mod-sale-endo") as HTMLInputElement | null;
    const sellEl = form.elements.namedItem("mod-sale-sell") as HTMLInputElement | null;
    const buyPrice = (buyEl && buyEl.value) ? buyEl.value : "";
    const endoUsed = (endoEl && endoEl.value) ? endoEl.value : "";
    const sellPrice = (sellEl && sellEl.value) ? sellEl.value : "";
    if (!modName) { toast.error("Enter mod name"); return; }
    const sp = parseInt(sellPrice, 10);
    if (!Number.isFinite(sp) || sp <= 0) { toast.error("Enter sell price"); return; }
    setSAdding(true);
    try {
      const res = await fetch("/api/mod-sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modName, buyPrice: parseInt(buyPrice, 10) || 0, endoUsed: parseInt(endoUsed, 10) || 0, sellPrice: sp }) });
      if (res.ok) { toast.success("Sale recorded"); form.reset(); setModNameValue(""); setAddSaleOpen(false); fetchData(); }
      else { const d = await res.json(); toast.error(d.error ?? "Failed"); }
    } catch { toast.error("Failed"); }
    setSAdding(false);
  };
  const saveModSale = async (id: string, d: { modName: string; buyPrice: string; endoUsed: string; sellPrice: string }) => {
    try { const r = await fetch(`/api/mod-sales/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }); if (r.ok) { setEditingSale(null); fetchData(); } else { const j = await r.json(); toast.error(j.error ?? "Failed"); } } catch { toast.error("Failed"); }
  };
  const deleteModSale = async (id: string) => { if (!confirm("Delete?")) return; try { const r = await fetch(`/api/mod-sales/${id}`, { method: "DELETE" }); if (r.ok) fetchData(); } catch { toast.error("Failed"); } };

  /* ── Computed stats ── */
  const rawDeals = data?.deals ?? [];
  const totalDealInvested = rawDeals.reduce((s, d) => s + d.buyPrice, 0);
  const totalEndoBanked = rawDeals.reduce((s, d) => s + d.endoValue, 0);
  const totalEndoUsedInSales = sales.reduce((s, sale) => s + sale.endoUsed, 0);
  const endoRemaining = totalEndoBanked - totalEndoUsedInSales;
  const avgPlatPerEndo = totalEndoBanked > 0 ? totalDealInvested / totalEndoBanked : 0;
  const avgEndoPerPlat = totalDealInvested > 0 ? totalEndoBanked / totalDealInvested : 0;

  const totalSalesRevenue = sales.reduce((s, sale) => s + sale.sellPrice, 0);
  const totalSalesBuyCost = sales.reduce((s, sale) => s + sale.buyPrice, 0);
  const totalEndoCostPlat = sales.reduce((s, sale) => s + sale.endoUsed * avgPlatPerEndo, 0);

  // Portfolio P&L: revenue from all sources minus total investment
  const portfolioIncome = (data?.stats?.totalIncome ?? 0) + totalSalesRevenue;
  const portfolioCost = totalDealInvested + totalSalesBuyCost;
  const portfolioProfit = portfolioIncome - portfolioCost;
  const portfolioRoi = portfolioCost > 0 ? (portfolioProfit / portfolioCost) * 100 : 0;

  // Avg E/P vs in-app threshold (green when above, show %)
  const threshold = data?.liquidityThreshold ?? 0;
  const avgEPDiff = threshold && avgEndoPerPlat > 0 ? fmtPctDiff(avgEndoPerPlat, threshold) : { text: "", color: "" };
  const avgEPValue = avgEndoPerPlat > 0 ? `${Math.round(avgEndoPerPlat)}${avgEPDiff.text ? ` ${avgEPDiff.text}` : ""}` : "—";
  const avgEPColor = avgEPDiff.color || "text-primary";

  // Per-sale: profit counting endo cost
  const salePnl = (sale: ModSaleRow) => {
    const endoCost = sale.endoUsed * avgPlatPerEndo;
    return sale.sellPrice - sale.buyPrice - endoCost;
  };

  // Misc metrics for drawer
  const avgEndoWaste = sales.length > 0 ? totalEndoUsedInSales / sales.length : 0;
  const totalSalesProfit = sales.reduce((s, sale) => s + salePnl(sale), 0);
  const avgModSaleProfit = sales.length > 0 ? totalSalesProfit / sales.length : 0;
  const approxTradesLeft = avgEndoWaste > 0 ? Math.floor(endoRemaining / avgEndoWaste) : 0;
  const estimatedProfits = approxTradesLeft * avgModSaleProfit;
  const estReturnsRevenue = Math.round(totalSalesProfit) + Math.round(estimatedProfits) + totalDealInvested;
  const estReturnsRoiPct = totalDealInvested > 0 ? ((Math.round(totalSalesProfit) + Math.round(estimatedProfits)) / totalDealInvested) * 100 : 0;
  const estReturnsRoiMult = totalDealInvested > 0 ? 1 + (Math.round(totalSalesProfit) + Math.round(estimatedProfits)) / totalDealInvested : 0;

  const trackerAccessor = useCallback(
    (d: TrackedDealRow, col: TrackerSortCol): number | string | Date | null => {
      switch (col) {
        case "riven": return d.weaponName;
        case "cost": return d.buyPrice;
        case "income": return d.totalIncome;
        case "profit": return d.profit;
        case "endoPerPlat": return d.endoPerPlat;
        case "reRolls": return d.reRolls;
        case "added": return d.createdAt ? new Date(d.createdAt) : null;
        default: return null;
      }
    }, []
  );

  const deals = useSorted(rawDeals, sort, trackerAccessor);

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }

  const statItems = [
    { label: "Invested", value: `${totalDealInvested}`, icon: <PlatIcon className="size-3.5 opacity-70" />, color: "text-foreground" },
    { label: "Endo Bank", value: fmtEndo(endoRemaining), icon: <EndoIcon className="size-3.5 opacity-70" />, color: "text-amber-400", sub: ` / ${fmtEndo(totalEndoBanked)}` },
    { label: "Avg E/P", value: avgEPValue, icon: <span className="inline-flex items-center gap-0.5 opacity-70"><EndoIcon className="size-3" /><span className="text-muted-foreground text-[10px]">/</span><PlatIcon className="size-3" /></span>, color: avgEPColor },
    { label: "Revenue", value: `${totalSalesRevenue}`, icon: <PlatIcon className="size-3.5 opacity-70" />, color: "text-neon-green" },
    { label: "P&L", value: `${portfolioProfit >= 0 ? "+" : ""}${Math.round(portfolioProfit)}`, icon: <PlatIcon className="size-3.5 opacity-70" />, color: portfolioProfit >= 0 ? "text-neon-green" : "text-destructive" },
    { label: "ROI", value: `${portfolioRoi.toFixed(1)}%`, icon: null, color: portfolioRoi >= 0 ? "text-neon-green" : "text-destructive" },
  ];

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden w-full max-w-none px-5 py-5 gap-5">
      {/* ── Top bar: title + stats + actions ── */}
      <header className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 shrink-0">
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Portfolio</h1>
          <div className="flex items-center gap-2 sm:hidden">
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setMiscStatsOpen(true)}><BarChart3 className="size-3.5" /></Button>
            <ManualDealDialog onAdded={fetchData} />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-6">
          {statItems.map((item, i) => (
            <div key={item.label} className="flex items-baseline gap-2">
              {i > 0 && <span className="hidden sm:inline text-border/50 text-xs font-mono">·</span>}
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">{item.label}</span>
              <span className={`text-sm font-bold font-mono tabular-nums ${item.color} inline-flex items-center gap-1`}>
                {item.icon}
                {item.value}
                {item.sub && <span className="text-muted-foreground font-normal text-xs">{item.sub}</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setMiscStatsOpen(true)}>
            <BarChart3 className="size-3.5" /> Misc Stats
          </Button>
          <ManualDealDialog onAdded={fetchData} />
        </div>
      </header>

      {/* ── Two-column layout: Endo Bank table | Mod Sales table ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0 min-w-0">
        {/* Left: Endo Bank table ── */}
        <section className="rounded-lg border border-border/30 bg-card/40 overflow-hidden flex flex-col min-h-0 min-w-0">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20 bg-muted/20 shrink-0">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Endo Bank · {rawDeals.length} deals</span>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-8">
                <TabsTrigger value="active" className="text-xs h-7 px-3 gap-1.5"><CircleDot className="size-2.5 text-neon-green" />Active</TabsTrigger>
                <TabsTrigger value="archived" className="text-xs h-7 px-3 gap-1.5"><Archive className="size-2.5" />Archived</TabsTrigger>
                <TabsTrigger value="all" className="text-xs h-7 px-3">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            {!deals.length ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">No deals yet. Add a deal to build your endo bank.</div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="border-border/20 hover:bg-transparent">
                    <TableHead className="text-xs font-mono h-9 px-3 w-8" />
                    <SortableHead column="riven" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} className="text-xs h-9 px-3 min-w-[100px]">Item</SortableHead>
                    <TableHead className="text-xs font-mono h-9 px-3 w-12 text-center">Src</TableHead>
                    <SortableHead column="cost" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} className="text-right text-xs h-9 px-3 w-16">Cost</SortableHead>
                    <SortableHead column="endoPerPlat" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} className="text-right text-xs h-9 px-3 w-20">E/P</SortableHead>
                    <SortableHead column="income" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} className="text-right text-xs h-9 px-3 w-16">Inc</SortableHead>
                    <SortableHead column="profit" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} className="text-right text-xs h-9 px-3 w-16">P&L</SortableHead>
                    <SortableHead column="added" sort={sort} onSort={(c) => setSort(toggleSort(sort, c))} className="text-xs h-9 px-3 w-14">Age</SortableHead>
                    <TableHead className="text-xs font-mono h-9 px-3 w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deals.map((deal) => {
                    const isExp = expanded.has(deal.id);
                    const pColor = deal.profit > 0 ? "text-neon-green" : deal.profit < 0 ? "text-destructive" : "text-muted-foreground";
                    return (
                      <React.Fragment key={deal.id}>
                        <TableRow className="border-border/10 hover:bg-muted/30 h-10 cursor-pointer" onClick={() => toggleExpand(deal.id)}>
                          <TableCell className="px-3 py-2">
                            {isExp ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="px-3 py-2 min-w-0">
                            <span className="text-sm font-medium truncate block">{deal.weaponName}</span>
                            {deal.rivenName && <span className="text-xs text-muted-foreground truncate block">{deal.rivenName}</span>}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-center">
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${deal.source === "reroll_value" ? "bg-neon-yellow/10 text-neon-yellow" : deal.source === "manual" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                              {deal.source === "reroll_value" ? "RR" : deal.source === "manual" ? "MN" : "RK"}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right font-mono text-sm font-semibold text-primary">{deal.buyPrice}</TableCell>
                          <TableCell className="px-3 py-2 text-right">
                            {deal.endoPerPlat > 0 ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="font-mono text-sm font-semibold text-neon-green">{Math.round(deal.endoPerPlat)}</span>
                                {data?.liquidityThreshold ? (() => { const d = fmtPctDiff(deal.endoPerPlat, data.liquidityThreshold); return d.text ? <span className={`font-mono text-xs ${d.color}`}>{d.text}</span> : null; })() : null}
                              </div>
                            ) : <span className="text-muted-foreground text-sm">—</span>}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right font-mono text-sm">
                            {deal.totalIncome > 0 ? <span className="text-neon-green font-semibold">{deal.totalIncome}</span> : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className={`px-3 py-2 text-right font-mono text-sm font-semibold ${pColor}`}>{deal.profit > 0 ? "+" : ""}{deal.profit}</TableCell>
                          <TableCell className="px-3 py-2 text-sm text-muted-foreground font-mono whitespace-nowrap">{timeAgo(deal.createdAt)}</TableCell>
                          <TableCell className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-0.5">
                              {deal.status === "active" ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => handleArchive(deal.id)}><Archive className="size-3.5" /></Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Archive</TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => handleUnarchive(deal.id)}><RotateCcw className="size-3.5" /></Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">Restore</TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => handleDelete(deal.id)}><Trash2 className="size-3.5" /></Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">Delete</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExp && (
                          <TableRow className="border-border/10 hover:bg-transparent bg-muted/10">
                            <TableCell colSpan={9} className="px-4 py-3">
                              <IncomePanel dealId={deal.id} onIncomeChange={fetchData} />
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        {/* Right: Mod Sales table ── */}
        <section className="rounded-lg border border-border/30 bg-card/40 overflow-hidden flex flex-col min-h-0 min-w-0">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20 bg-muted/20 shrink-0">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Mod Sales</span>
            <div className="rounded-lg bg-muted p-[3px] h-8 inline-flex items-center">
              <Button variant="ghost" size="sm" className="h-7 rounded-md px-3 text-xs font-medium gap-1.5 bg-background text-foreground shadow-sm cursor-pointer hover:bg-background/90 dark:bg-input/30 dark:hover:bg-input/50" onClick={() => setAddSaleOpen(true)}>
                <Plus className="size-2.5" /> Add Sale
              </Button>
            </div>
          </div>
          <Dialog open={addSaleOpen} onOpenChange={setAddSaleOpen}>
            <DialogContent
              className="sm:max-w-sm"
              onInteractOutside={(e) => e.preventDefault()}
              onPointerDownOutside={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle className="text-sm">Add Mod Sale</DialogTitle>
              </DialogHeader>
              <form
                ref={addSaleFormRef}
                onSubmit={(e) => addModSale(e)}
                className="grid gap-3 py-2"
                autoComplete="on"
              >
                <div className="space-y-1.5 relative">
                  <Label htmlFor="mod-sale-name" className="text-xs text-muted-foreground">Mod name</Label>
                  <Input
                    ref={modNameInputRef}
                    id="mod-sale-name"
                    name="mod-sale-name"
                    autoComplete="off"
                    placeholder="e.g. Serration"
                    className="h-9 text-sm"
                    value={modNameValue}
                    onChange={(e) => { setModNameValue(e.target.value); setSuggestionHighlight(0); }}
                    onFocus={() => {
                      if (modNameBlurTimerRef.current) { clearTimeout(modNameBlurTimerRef.current); modNameBlurTimerRef.current = null; }
                      setModNameSuggestionsOpen(true);
                    }}
                    onBlur={() => {
                      modNameBlurTimerRef.current = setTimeout(() => setModNameSuggestionsOpen(false), 180);
                    }}
                    onKeyDown={(e) => {
                      if (!modNameSuggestionsOpen || filteredModSuggestions.length === 0) return;
                      if (e.key === "ArrowDown") { e.preventDefault(); setSuggestionHighlight((i) => (i + 1) % filteredModSuggestions.length); }
                      else if (e.key === "ArrowUp") { e.preventDefault(); setSuggestionHighlight((i) => (i - 1 + filteredModSuggestions.length) % filteredModSuggestions.length); }
                      else if (e.key === "Enter" && filteredModSuggestions[suggestionHighlight]) { e.preventDefault(); applyModSuggestion(filteredModSuggestions[suggestionHighlight]); }
                      else if (e.key === "Escape") { setModNameSuggestionsOpen(false); modNameInputRef.current?.blur(); }
                    }}
                  />
                  {modNameSuggestionsOpen && filteredModSuggestions.length > 0 && (
                    <ul
                      className="absolute top-full left-0 right-0 z-50 mt-0.5 rounded-md border border-border/40 bg-card shadow-lg py-1 max-h-40 overflow-auto"
                      role="listbox"
                      aria-label="Previous mods"
                    >
                      {filteredModSuggestions.map((s, i) => (
                        <li
                          key={s.modName}
                          role="option"
                          aria-selected={i === suggestionHighlight}
                          className={`cursor-pointer px-3 py-1.5 text-sm flex items-center justify-between gap-2 ${i === suggestionHighlight ? "bg-muted" : "hover:bg-muted/70"}`}
                          onMouseDown={(e) => { e.preventDefault(); applyModSuggestion(s); }}
                          onMouseEnter={() => setSuggestionHighlight(i)}
                        >
                          <span className="font-medium truncate">{s.modName}</span>
                          <span className="text-xs text-muted-foreground font-mono shrink-0">{s.buyPrice} / {s.endoUsed.toLocaleString()} / {s.sellPrice}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="mod-sale-buy" className="text-xs text-muted-foreground flex items-center gap-1"><PlatIcon className="size-2.5 opacity-70" /> Buy</Label>
                    <Input
                      id="mod-sale-buy"
                      name="mod-sale-buy"
                      type="number"
                      autoComplete="on"
                      placeholder="0"
                      className="h-9 text-sm font-mono"
                      min={0}
                      defaultValue=""
                    />
                  </div>
                  <div className="space-y-1.5 relative">
                    <Label htmlFor="mod-sale-endo" className="text-xs text-muted-foreground flex items-center gap-1"><EndoIcon className="size-2.5 opacity-70" /> Endo</Label>
                    <Input
                      ref={endoInputRef}
                      id="mod-sale-endo"
                      name="mod-sale-endo"
                      type="number"
                      autoComplete="off"
                      placeholder="0"
                      className="h-9 text-sm font-mono"
                      min={0}
                      defaultValue=""
                      onFocus={() => {
                        if (endoBlurTimerRef.current) { clearTimeout(endoBlurTimerRef.current); endoBlurTimerRef.current = null; }
                        setEndoSuggestionsOpen(true);
                        setEndoHighlight(0);
                      }}
                      onBlur={() => {
                        endoBlurTimerRef.current = setTimeout(() => setEndoSuggestionsOpen(false), 180);
                      }}
                      onKeyDown={(e) => {
                        if (!endoSuggestionsOpen || endoSuggestions.length === 0) return;
                        if (e.key === "ArrowDown") { e.preventDefault(); setEndoHighlight((i) => (i + 1) % endoSuggestions.length); }
                        else if (e.key === "ArrowUp") { e.preventDefault(); setEndoHighlight((i) => (i - 1 + endoSuggestions.length) % endoSuggestions.length); }
                        else if (e.key === "Enter" && endoSuggestions[endoHighlight] != null) { e.preventDefault(); applyEndoSuggestion(endoSuggestions[endoHighlight]); }
                        else if (e.key === "Escape") { setEndoSuggestionsOpen(false); endoInputRef.current?.blur(); }
                      }}
                    />
                    {endoSuggestionsOpen && endoSuggestions.length > 0 && (
                      <ul
                        className="absolute top-full left-0 right-0 z-50 mt-0.5 rounded-md border border-border/40 bg-card shadow-lg py-1 max-h-40 overflow-auto"
                        role="listbox"
                        aria-label="Previous endo values"
                      >
                        {endoSuggestions.map((val, i) => (
                          <li
                            key={val}
                            role="option"
                            aria-selected={i === endoHighlight}
                            className={`cursor-pointer px-3 py-1.5 text-sm font-mono flex items-center gap-2 ${i === endoHighlight ? "bg-muted" : "hover:bg-muted/70"}`}
                            onMouseDown={(ev) => { ev.preventDefault(); applyEndoSuggestion(val); }}
                            onMouseEnter={() => setEndoHighlight(i)}
                          >
                            <EndoIcon className="size-3 opacity-70" />
                            {val.toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mod-sale-sell" className="text-xs text-muted-foreground flex items-center gap-1"><PlatIcon className="size-2.5 opacity-70" /> Sell</Label>
                    <Input
                      id="mod-sale-sell"
                      name="mod-sale-sell"
                      type="number"
                      autoComplete="on"
                      placeholder="0"
                      className="h-9 text-sm font-mono"
                      min={1}
                      defaultValue=""
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" className="w-full h-9 cursor-pointer" disabled={sAdding}>
                  {sAdding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Add Sale
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          <div className="flex-1 min-h-0 overflow-auto">
            {sales.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">No sales yet. Click Add Sale to record one.</div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="border-border/20 hover:bg-transparent">
                    <TableHead className="text-xs font-mono h-9 px-4 whitespace-nowrap">Mod</TableHead>
                    <TableHead className="text-xs font-mono h-9 px-4 w-20 text-right">Buy</TableHead>
                    <TableHead className="text-xs font-mono h-9 px-4 w-24 text-right">Endo</TableHead>
                    <TableHead className="text-xs font-mono h-9 px-4 w-20 text-right">Sell</TableHead>
                    <TableHead className="text-xs font-mono h-9 px-4 w-20 text-right">Profit</TableHead>
                    <TableHead className="text-xs font-mono h-9 px-4 w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => {
                    if (editingSale === sale.id) return <EditableModSaleRow key={sale.id} sale={sale} onSave={saveModSale} onCancel={() => setEditingSale(null)} />;
                    const profit = salePnl(sale);
                    return (
                      <TableRow key={sale.id} className="border-border/10 hover:bg-muted/30 h-10">
                        <TableCell className="px-4 py-2.5 text-sm font-medium min-w-0">{sale.modName}</TableCell>
                        <TableCell className="px-4 py-2.5 text-right font-mono text-sm">{sale.buyPrice || "—"}</TableCell>
                        <TableCell className="px-4 py-2.5 text-right font-mono text-sm text-amber-400">{fmtEndo(sale.endoUsed)}</TableCell>
                        <TableCell className="px-4 py-2.5 text-right font-mono text-sm font-semibold text-neon-green">{sale.sellPrice}</TableCell>
                        <TableCell className={`px-4 py-2.5 text-right font-mono text-sm font-semibold ${profit >= 0 ? "text-neon-green" : "text-destructive"}`}>{profit >= 0 ? "+" : ""}{Math.round(profit)}</TableCell>
                        <TableCell className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => setEditingSale(sale.id)}><Pencil className="size-3.5" /></Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => deleteModSale(sale.id)}><Trash2 className="size-3.5" /></Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      </div>

      {/* ── Misc Stats drawer ── */}
      <Sheet open={miscStatsOpen} onOpenChange={setMiscStatsOpen}>
        <SheetContent side="right" className="sm:max-w-xl w-full flex flex-col gap-0 p-4 sm:p-5">
          <SheetHeader className="border-b border-border/20 pb-3">
            <SheetTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              Misc Stats
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto py-4 space-y-0">
            {/* ── Group 1: Mod sales (per-sale metrics) ── */}
            <section className="space-y-2">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-0.5">
                Mod sales
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-card/60 rounded-md border border-border/20 px-3 py-2 flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">Avg profit</span>
                  <span className={`text-sm font-bold font-mono tabular-nums inline-flex items-center gap-1 ${avgModSaleProfit >= 0 ? "text-neon-green" : "text-destructive"}`}>
                    {sales.length > 0 ? `${avgModSaleProfit >= 0 ? "+" : ""}${Math.round(avgModSaleProfit)}` : "—"}
                    {sales.length > 0 && <PlatIcon className="size-3 opacity-60" />}
                  </span>
                </div>
                <div className="bg-card/60 rounded-md border border-border/20 px-3 py-2 flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">Avg endo/sale</span>
                  <span className="text-sm font-bold font-mono tabular-nums text-amber-400 inline-flex items-center gap-1">
                    {sales.length > 0 ? fmtEndo(Math.round(avgEndoWaste)) : "—"}
                    {sales.length > 0 && <EndoIcon className="size-3 opacity-60" />}
                  </span>
                </div>
              </div>
            </section>

            {/* ── Divider ── */}
            <div className="border-t border-border/30 my-4" role="separator" aria-hidden />

            {/* ── Group 2: Endo bank & returns ── */}
            <section className="space-y-2">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-0.5">
                Endo bank & returns
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-card/60 rounded-md border border-border/20 px-3 py-2 flex flex-col gap-0.5">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">Trades left</span>
                  <span className="text-sm font-bold font-mono tabular-nums text-primary">
                    {avgEndoWaste > 0 ? approxTradesLeft.toLocaleString() : "—"}
                  </span>
                </div>
                <div className="bg-card/60 rounded-md border border-border/20 px-3 py-2 flex flex-col gap-0">
                  <span className="text-sm text-muted-foreground mb-1.5">Est. returns</span>
                  {(sales.length > 0 || totalDealInvested > 0) ? (
                    <div className="font-mono tabular-nums space-y-0.5">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="text-sm text-muted-foreground shrink-0 lowercase">profits</span>
                        <span className="inline-flex items-center gap-0.5 flex-wrap justify-end font-semibold">
                          <span className={totalSalesProfit >= 0 ? "text-neon-green" : "text-destructive"}>{totalSalesProfit >= 0 ? "+" : ""}{Math.round(totalSalesProfit)}</span>
                          <span className="text-muted-foreground font-normal">+</span>
                          <span className={estimatedProfits >= 0 ? "text-neon-green" : "text-destructive"}>{estimatedProfits >= 0 ? "+" : ""}{Math.round(estimatedProfits)}</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="text-sm text-muted-foreground shrink-0 lowercase">investment</span>
                        <span className="font-semibold text-primary">+{totalDealInvested.toLocaleString()}</span>
                      </div>
                      <div className="border-t border-border/30 pt-1 mt-1 flex justify-between items-baseline gap-2">
                        <span className="text-sm text-muted-foreground shrink-0 lowercase">=</span>
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <span className="text-amber-400">{estReturnsRevenue.toLocaleString()}</span>
                          {totalDealInvested > 0 && (
                            <span className={estReturnsRoiPct >= 0 ? "text-neon-green" : "text-destructive"} title={`${estReturnsRoiPct.toFixed(0)}% ROI = ${estReturnsRoiMult.toFixed(2)}× total return (e.g. 648 × 2.2 ≈ 1443)`}>
                              ({estReturnsRoiPct.toFixed(0)}% = {estReturnsRoiMult.toFixed(1)}×)
                            </span>
                          )}
                          <PlatIcon className="size-3 opacity-70" />
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="font-mono text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </section>

            {/* ── Divider ── */}
            <div className="border-t border-border/30 my-4" role="separator" aria-hidden />

            {/* ── Group 3: Tools (what-if calculator) ── */}
            <section className="space-y-2">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-0.5">
                <Calculator className="size-3 opacity-70" />
                Estimate avg E/P
              </h3>
              <div className="rounded-md border border-border/30 bg-card/60 p-3 space-y-3 relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 w-px bg-primary/25" aria-hidden />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="estimate-plat" className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <PlatIcon className="size-2.5 opacity-70" />
                      Plat
                    </Label>
                    <Input
                      id="estimate-plat"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="200"
                      value={estimatePlat}
                      onChange={(e) => setEstimatePlat(e.target.value)}
                      className="font-mono h-8 text-sm bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="estimate-endo" className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <EndoIcon className="size-2.5 opacity-70" />
                      Endo
                    </Label>
                    <Input
                      id="estimate-endo"
                      type="number"
                      min={0}
                      step={1000}
                      placeholder="103500"
                      value={estimateEndo}
                      onChange={(e) => setEstimateEndo(e.target.value)}
                      className="font-mono h-8 text-sm bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                </div>
                {(() => {
                  const plat = parseFloat(estimatePlat);
                  const endo = parseFloat(estimateEndo);
                  const valid = Number.isFinite(plat) && plat > 0 && Number.isFinite(endo) && endo >= 0;
                  const newInvested = totalDealInvested + (valid ? plat : 0);
                  const newEndo = totalEndoBanked + (valid ? endo : 0);
                  const newAvgEP = newInvested > 0 ? newEndo / newInvested : 0;
                  const newPct = threshold && newAvgEP > 0 ? ((newAvgEP - threshold) / threshold) * 100 : null;
                  const dealEP = valid && plat > 0 ? endo / plat : 0;
                  const pctUp = newPct != null && avgEndoPerPlat > 0 && threshold > 0
                    ? ((avgEndoPerPlat - threshold) / threshold) * 100
                    : null;
                  // Simulated est. returns if this purchase is added (same logic as Est. returns section)
                  const simInvested = valid ? newInvested : totalDealInvested;
                  const totalProfit = Math.round(totalSalesProfit) + Math.round(estimatedProfits);
                  const simRevenue = totalProfit + simInvested;
                  const simRoiPct = simInvested > 0 ? (totalProfit / simInvested) * 100 : 0;
                  const simRoiMult = simInvested > 0 ? simRevenue / simInvested : 0;
                  return (
                    <div className="space-y-2 pt-2 border-t border-border/20">
                      {valid && (
                        <>
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="rounded border border-border/20 bg-muted/20 py-1.5 px-1.5 text-center">
                              <span className="text-[9px] font-mono uppercase text-muted-foreground block">Deal</span>
                              <span className="font-mono text-xs font-semibold tabular-nums">{Math.round(dealEP)}</span>
                            </div>
                            <div className="rounded border border-border/20 bg-muted/20 py-1.5 px-1.5 text-center flex flex-col justify-center">
                              <span className="text-[9px] font-mono uppercase text-muted-foreground block">Curr</span>
                              <span className="font-mono text-xs font-semibold tabular-nums">{avgEndoPerPlat > 0 ? Math.round(avgEndoPerPlat) : "—"}</span>
                            </div>
                            <div className="rounded border border-primary/30 bg-primary/5 py-1.5 px-1.5 text-center flex flex-col justify-center">
                              <span className="text-[9px] font-mono uppercase text-muted-foreground block">New</span>
                              <span className="font-mono text-xs font-bold tabular-nums text-primary">{Math.round(newAvgEP)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded border border-border/20 bg-card/40 px-2.5 py-1.5">
                            <span className="text-[10px] text-muted-foreground flex-1">Avg E/P</span>
                            <span className="font-mono text-xs text-muted-foreground tabular-nums">{avgEndoPerPlat > 0 ? Math.round(avgEndoPerPlat) : "—"}</span>
                            <ArrowRight className="size-3 text-muted-foreground/50 shrink-0" />
                            <span className="font-mono text-xs font-bold tabular-nums text-primary">{Math.round(newAvgEP)}</span>
                          </div>
                          {threshold != null && threshold > 0 && (
                            <div className="flex items-center gap-2 rounded border border-border/20 bg-card/40 px-2.5 py-1.5">
                              <span className="text-[10px] text-muted-foreground flex-1">% vs threshold</span>
                              <span className="font-mono text-xs text-muted-foreground tabular-nums">{pctUp != null ? `${pctUp >= 0 ? "+" : ""}${Math.round(pctUp)}%` : "—"}</span>
                              <ArrowRight className="size-3 text-muted-foreground/50 shrink-0" />
                              <span className={`font-mono text-xs font-bold tabular-nums ${newPct != null ? (newPct >= 0 ? "text-neon-green" : "text-destructive") : ""}`}>
                                {newPct != null ? `${newPct >= 0 ? "+" : ""}${Math.round(newPct)}%` : "—"}
                              </span>
                            </div>
                          )}
                          {(sales.length > 0 || simInvested > 0) && (
                            <div className="rounded-md border border-border/20 bg-card/40 px-3 py-2 mt-2">
                              <span className="text-sm text-muted-foreground mb-1.5 block">Est. returns if you add this</span>
                              <div className="font-mono tabular-nums space-y-0.5">
                                <div className="flex justify-between items-baseline gap-2">
                                  <span className="text-sm text-muted-foreground shrink-0 lowercase">profits</span>
                                  <span className="inline-flex items-center gap-0.5 flex-wrap justify-end font-semibold">
                                    <span className={totalSalesProfit >= 0 ? "text-neon-green" : "text-destructive"}>{totalSalesProfit >= 0 ? "+" : ""}{Math.round(totalSalesProfit)}</span>
                                    <span className="text-muted-foreground font-normal">+</span>
                                    <span className={estimatedProfits >= 0 ? "text-neon-green" : "text-destructive"}>{estimatedProfits >= 0 ? "+" : ""}{Math.round(estimatedProfits)}</span>
                                  </span>
                                </div>
                                <div className="flex justify-between items-baseline gap-2">
                                  <span className="text-sm text-muted-foreground shrink-0 lowercase">investment</span>
                                  <span className="font-semibold text-primary">+{simInvested.toLocaleString()}</span>
                                </div>
                                <div className="border-t border-border/30 pt-1 mt-1 flex justify-between items-baseline gap-2">
                                  <span className="text-sm text-muted-foreground shrink-0 lowercase">=</span>
                                  <span className="inline-flex items-center gap-1 font-semibold">
                                    <span className="text-amber-400">{simRevenue.toLocaleString()}</span>
                                    {simInvested > 0 && (
                                      <span className={simRoiPct >= 0 ? "text-neon-green" : "text-destructive"} title={`${simRoiPct.toFixed(0)}% ROI = ${simRoiMult.toFixed(2)}× total return`}>
                                        ({simRoiPct.toFixed(0)}% = {simRoiMult.toFixed(1)}×)
                                      </span>
                                    )}
                                    <PlatIcon className="size-3 opacity-70" />
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {!valid && (estimatePlat !== "" || estimateEndo !== "") && (
                        <p className="text-[10px] text-muted-foreground/90 text-center py-1">Plat &gt; 0, endo ≥ 0</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </section>

            {sales.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center mt-4 pt-4 border-t border-border/20">Record mod sales to see stats.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
