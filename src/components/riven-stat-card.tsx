"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WhisperButton } from "./whisper-button";
import { Circle, ExternalLink, Search as SearchIcon } from "lucide-react";
import type { RivenSnapshot } from "@/lib/db/schema";

interface RivenAttribute {
  positive: boolean;
  value: number;
  url_name: string;
}

interface AttributeInfo {
  urlName: string;
  effect: string;
  units: string | null;
  positiveIsNegative: boolean;
}

interface RivenStatCardProps {
  deal: RivenSnapshot;
  /** Map of url_name -> human-readable attribute info */
  attributeMap?: Map<string, AttributeInfo>;
  whisperTemplate?: string;
}

const POLARITY_SYMBOLS: Record<string, string> = {
  madurai: "V",
  vazarin: "D",
  naramon: "—",
  zenurik: "=",
};

function formatStatValue(value: number, units: string | null): string {
  if (units === "seconds") return `${value}s`;
  return `${value}%`;
}

function getStatusLabel(status: string): string {
  if (status === "ingame") return "IN GAME";
  return status.toUpperCase();
}

function getStatusColor(status: string): string {
  if (status === "ingame" || status === "online") return "text-neon-green";
  return "text-neon-orange";
}

export function RivenStatCard({
  deal,
  attributeMap,
  whisperTemplate,
}: RivenStatCardProps) {
  const attributes = (deal.attributes as RivenAttribute[]) ?? [];

  return (
    <div className="rounded-lg border border-border/40 bg-card/60 hover:bg-card/80 transition-colors p-4 space-y-2.5">
      {/* Row 1: Riven name + action icons */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-primary truncate">
          {deal.weaponName || deal.weaponUrlName}{" "}
          <span className="text-muted-foreground font-normal">
            {deal.rivenName || ""}
          </span>
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          {deal.wfmAuctionUrl && (
            <a
              href={deal.wfmAuctionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              title="View on Warframe Market"
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Row 2: Stat pills */}
      <div className="flex flex-wrap gap-1.5">
        {attributes.map((attr, i) => {
          const info = attributeMap?.get(attr.url_name);
          const statName = info?.effect ?? attr.url_name.replace(/_/g, " ");
          const units = info?.units ?? "percent";
          const isActuallyPositive = info?.positiveIsNegative
            ? !attr.positive
            : attr.positive;

          const prefix = attr.positive ? "+" : "-";
          const absValue = Math.abs(attr.value);
          const display = `${prefix}${formatStatValue(absValue, units)} ${statName}`;

          return (
            <Badge
              key={i}
              variant="outline"
              className={`text-xs font-mono px-2 py-0.5 ${
                isActuallyPositive
                  ? "border-neon-green/40 bg-neon-green/10 text-neon-green"
                  : "border-destructive/40 bg-destructive/10 text-destructive"
              }`}
            >
              {display}
            </Badge>
          );
        })}
      </div>

      {/* Row 3: Meta + Price */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground font-mono">
          Mr: {deal.masteryLevel} &nbsp; Rank: {deal.modRank} &nbsp; Re-rolls:{" "}
          {deal.reRolls} &nbsp; Polarity:{" "}
          {POLARITY_SYMBOLS[deal.polarity ?? ""] ?? deal.polarity ?? "?"}
        </span>
        <div className="text-right shrink-0">
          <span className="text-sm font-bold font-mono text-primary">
            {deal.buyoutPrice ?? "?"}p
          </span>
          {deal.endoPerPlat > 0 && (
            <span className="text-xs font-mono text-neon-green ml-2">
              {Math.round(deal.endoPerPlat)} endo/p
            </span>
          )}
        </div>
      </div>

      {/* Row 4: Seller + Whisper */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30">
        <div className="flex items-center gap-1.5 min-w-0">
          <Circle
            className={`size-2 fill-current shrink-0 ${getStatusColor(deal.ownerStatus)}`}
          />
          <span className="text-xs font-mono truncate">
            {deal.ownerIgn}
          </span>
          <span
            className={`text-[10px] font-bold uppercase ${getStatusColor(deal.ownerStatus)}`}
          >
            {getStatusLabel(deal.ownerStatus)}
          </span>
          {deal.ownerReputation > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {deal.ownerReputation} rep
            </span>
          )}
        </div>
        <WhisperButton
          ign={deal.ownerIgn}
          rivenName={deal.rivenName || "Riven"}
          price={deal.buyoutPrice || 0}
          auctionUrl={deal.wfmAuctionUrl}
          weaponName={deal.weaponName || deal.weaponUrlName}
          template={whisperTemplate}
        />
      </div>

      {/* Liquid badge */}
      {deal.isLiquid && (
        <div className="flex justify-end">
          <Badge className="bg-neon-green/20 text-neon-green border-neon-green/30 text-[10px] h-4">
            LIQUID
          </Badge>
        </div>
      )}
    </div>
  );
}
