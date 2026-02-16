"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Eye, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface WatchButtonPayload {
  wfmAuctionId: string;
  source: "rank_value" | "reroll_value";
  weaponUrlName: string;
  weaponName: string;
  rivenName?: string | null;
  buyoutPrice?: number | null;
  startingPrice?: number | null;
  ownerIgn: string;
  ownerStatus?: string;
  wfmAuctionUrl?: string | null;
  /** Copied at add-time (no FK); for display after arbitrage purge */
  endoPerPlat?: number;
  endoValue?: number;
  reRolls?: number;
  masteryLevel?: number;
  auctionCreatedAt?: string | Date | null;
  auctionUpdatedAt?: string | Date | null;
}

export function WatchButton({
  deal,
  isWatched = false,
  onAdded,
}: {
  deal: WatchButtonPayload;
  /** When true, auction is already in watchlist: show disabled state and do not add again */
  isWatched?: boolean;
  /** Called after successfully adding to watchlist (e.g. to refetch watched IDs for row highlight) */
  onAdded?: () => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "watching">(
    isWatched ? "watching" : "idle"
  );

  const handleWatch = async () => {
    if (isWatched) return;
    setState("loading");
    try {
      const res = await fetch("/api/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wfmAuctionId: deal.wfmAuctionId,
          source: deal.source,
          weaponUrlName: deal.weaponUrlName,
          weaponName: deal.weaponName,
          rivenName: deal.rivenName ?? null,
          buyoutPrice: deal.buyoutPrice ?? null,
          startingPrice: deal.startingPrice ?? null,
          ownerIgn: deal.ownerIgn,
          ownerStatus: deal.ownerStatus ?? "offline",
          wfmAuctionUrl: deal.wfmAuctionUrl ?? null,
          endoPerPlat: deal.endoPerPlat ?? 0,
          endoValue: deal.endoValue ?? 0,
          reRolls: deal.reRolls ?? 0,
          masteryLevel: deal.masteryLevel ?? null,
          auctionCreatedAt: deal.auctionCreatedAt ? (typeof deal.auctionCreatedAt === "string" ? deal.auctionCreatedAt : (deal.auctionCreatedAt as Date).toISOString()) : null,
          auctionUpdatedAt: deal.auctionUpdatedAt ? (typeof deal.auctionUpdatedAt === "string" ? deal.auctionUpdatedAt : (deal.auctionUpdatedAt as Date).toISOString()) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("watching");
        toast.success("Added to watchlist");
        onAdded?.();
      } else if (res.status === 409 || data.alreadyWatching) {
        setState("watching");
        toast.info("Already watching this auction");
      } else {
        toast.error(data.error ?? "Failed to add to watchlist");
        setState("idle");
      }
    } catch {
      toast.error("Failed to add to watchlist");
      setState("idle");
    }
  };

  const watching = state === "watching" || isWatched;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-100"
          onClick={handleWatch}
          disabled={state === "loading" || isWatched}
        >
          {state === "loading" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : watching ? (
            <Eye className="size-3 text-primary" />
          ) : (
            <Eye className="size-3" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {isWatched || watching ? "In watchlist" : "Add to watchlist"}
      </TooltipContent>
    </Tooltip>
  );
}
