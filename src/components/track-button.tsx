"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface TrackDealPayload {
  source: "rank_value" | "reroll_value";
  weaponUrlName: string;
  weaponName: string;
  rivenName?: string | null;
  reRolls: number;
  modRank: number;
  masteryLevel: number;
  buyPrice: number;
  endoValue: number;
  endoPerPlat: number;
  attributes: unknown;
  polarity?: string | null;
  sellerIgn: string;
  wfmAuctionUrl?: string | null;
  platform: string;
}

export function TrackButton({
  deal,
  onAdded,
}: {
  deal: TrackDealPayload;
  onAdded?: () => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const handleTrack = async () => {
    setState("loading");
    try {
      const res = await fetch("/api/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deal),
      });
      if (res.ok) {
        setState("done");
        toast.success("Added to tracker");
        onAdded?.();
        setTimeout(() => setState("idle"), 2000);
      } else {
        const d = await res.json();
        toast.error(d.error ?? "Failed to track");
        setState("idle");
      }
    } catch {
      toast.error("Failed to track");
      setState("idle");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={handleTrack}
      disabled={state === "loading"}
      title="Add to tracker"
    >
      {state === "loading" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : state === "done" ? (
        <Check className="size-3 text-neon-green" />
      ) : (
        <Plus className="size-3" />
      )}
    </Button>
  );
}
